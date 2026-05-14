// ─────────────────────────────────────────────────────────────────────────────
// Per-creative regeneration.
//
// The full AngleAgent generates all 3 angles in one shot, which is wasteful
// when the user only wants to retry the copy on a single angle/platform. We
// keep a narrow Groq prompt scoped to one (angle, platform) and slot the
// result into sprint_creatives via patchCreative — which automatically:
//   1. Demotes 'approved' → 'reviewing'
//   2. Clears any stale policy_severity / policy_issues
//
// Only Meta is wired today (the only deployed channel). Other platforms
// short-circuit to the stored angle copy as a deterministic fallback.
// ─────────────────────────────────────────────────────────────────────────────

import { callGroqJSON } from '@/lib/groq';
import { createServiceClient } from '@/lib/supabase';
import { patchCreative, getCreative, upsertCreative } from './store';
import type {
  Angle,
  AngleAgentOutput,
  GenomeAgentOutput,
  Platform,
  SprintCreative,
  SprintCreativeEditable,
} from '@/lib/agents/types';

export interface RegenerateInput {
  sprint_id: string;
  angle_id: string;
  platform: Platform;
  /** Optional creative direction the user typed in the canvas. */
  direction?: string;
}

interface MetaCopyResponse {
  headline: string;
  primary_text: string;
  description: string;
  cta: string;
}

const META_SYSTEM = `You are AngleAgent inside LaunchLense, regenerating copy for a single Meta ad.
Rules:
- headline ≤ 40 chars. Visual-led. Supports an image, does not explain it.
- primary_text ≤ 125 chars. Completes the visual story; no banned words.
- description ≤ 30 chars. Optional sub-headline. Concrete benefit.
- cta MUST be one of: LEARN_MORE, SIGN_UP, GET_QUOTE, CONTACT_US, SUBSCRIBE, DOWNLOAD, GET_OFFER, BOOK_TRAVEL, APPLY_NOW, SHOP_NOW.
- Avoid the previous headline verbatim. Avoid "guarantee", "cure", "before/after", "miracle".
Return ONLY JSON. No markdown fences.`;

function buildMetaPrompt(args: {
  idea: string;
  icp: string;
  value_prop: string;
  archetype: string;
  emotional_lever: string;
  previous: { headline?: string | null; primary_text?: string | null };
  direction?: string;
}): string {
  return `Regenerate Meta ad copy for this angle. Stay on the same archetype + lever.

IDEA: "${args.idea}"
ICP: "${args.icp}"
VALUE PROP: "${args.value_prop}"
ARCHETYPE: ${args.archetype}
EMOTIONAL LEVER: ${args.emotional_lever}
PREVIOUS HEADLINE: "${args.previous.headline ?? '(none)'}"
PREVIOUS PRIMARY TEXT: "${args.previous.primary_text ?? '(none)'}"
${args.direction ? `USER DIRECTION: "${args.direction}"` : ''}

Return:
{
  "headline": "<≤40 chars>",
  "primary_text": "<≤125 chars>",
  "description": "<≤30 chars>",
  "cta": "<one of LEARN_MORE | SIGN_UP | GET_QUOTE | CONTACT_US | SUBSCRIBE | DOWNLOAD | GET_OFFER | BOOK_TRAVEL | APPLY_NOW | SHOP_NOW>"
}`;
}

interface SprintRowSubset {
  id: string;
  idea: string;
  genome: GenomeAgentOutput | null;
  angles: AngleAgentOutput | null;
}

async function loadSprint(sprintId: string): Promise<SprintRowSubset> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('sprints')
    .select('id, idea, genome, angles')
    .eq('id', sprintId)
    .single();
  if (error || !data) {
    throw new Error(`regenerateCreative: sprint ${sprintId} not found`);
  }
  return data as SprintRowSubset;
}

function findAngle(sprint: SprintRowSubset, angleId: string): Angle | null {
  const a = sprint.angles?.angles.find((x) => x.id === angleId);
  return a ?? null;
}

function trim(s: unknown, max: number): string {
  return String(s ?? '').slice(0, max).trim();
}

// ── Per-platform regenerators ─────────────────────────────────────────────

async function regenerateMeta(
  sprint: SprintRowSubset,
  angle: Angle,
  existing: SprintCreative | null,
  direction?: string
): Promise<Partial<SprintCreativeEditable>> {
  const previousHeadline = existing?.headline ?? angle.copy.meta.headline;
  const previousBody = existing?.primary_text ?? angle.copy.meta.body;

  let raw: MetaCopyResponse;
  try {
    raw = await callGroqJSON<MetaCopyResponse>(
      [
        { role: 'system', content: META_SYSTEM },
        {
          role: 'user',
          content: buildMetaPrompt({
            idea: sprint.idea,
            icp: sprint.angles?.icp ?? sprint.genome?.icp ?? '',
            value_prop: sprint.angles?.value_prop ?? '',
            archetype: angle.archetype,
            emotional_lever: angle.emotional_lever,
            previous: { headline: previousHeadline, primary_text: previousBody },
            direction,
          }),
        },
      ],
      { temperature: 0.85, max_tokens: 400 }
    );
  } catch (err) {
    console.warn('[regenerateCreative] Groq failed, falling back to angle copy:', err);
    return {
      headline: angle.copy.meta.headline,
      primary_text: angle.copy.meta.body,
      description: null,
      cta: 'LEARN_MORE',
    };
  }

  return {
    headline: trim(raw.headline, 40),
    primary_text: trim(raw.primary_text, 125),
    description: trim(raw.description, 30) || null,
    cta: trim(raw.cta, 40).toUpperCase() || 'LEARN_MORE',
  };
}

function regenerateFromAngleCopy(
  angle: Angle,
  platform: Platform
): Partial<SprintCreativeEditable> {
  switch (platform) {
    case 'google':
      return {
        headline: angle.copy.google.headline1,
        primary_text: angle.copy.google.description,
        description: angle.copy.google.headline2,
        cta: angle.cta,
      };
    case 'linkedin':
      return {
        headline: angle.copy.linkedin.headline,
        primary_text: angle.copy.linkedin.body,
        description: angle.copy.linkedin.intro,
        cta: angle.cta,
      };
    case 'tiktok':
      return {
        headline: angle.copy.tiktok.overlay,
        primary_text: angle.copy.tiktok.hook,
        hook: angle.copy.tiktok.hook,
        cta: angle.cta,
      };
    default:
      return {};
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export async function regenerateCreative(
  input: RegenerateInput
): Promise<SprintCreative> {
  const { sprint_id, angle_id, platform, direction } = input;

  const sprint = await loadSprint(sprint_id);
  const angle = findAngle(sprint, angle_id);
  if (!angle) {
    throw new Error(`regenerateCreative: angle "${angle_id}" not found on sprint`);
  }

  const existing = await getCreative(sprint_id, angle_id, platform);

  const fields: Partial<SprintCreativeEditable> =
    platform === 'meta'
      ? await regenerateMeta(sprint, angle, existing, direction)
      : regenerateFromAngleCopy(angle, platform);

  // patchCreative requires the row to exist. If this is the first time
  // we've touched the (sprint, angle, platform) tuple, seed it via upsert
  // before patching so we still get the auto-invalidation semantics on
  // subsequent regenerations.
  if (!existing) {
    await upsertCreative({
      sprint_id, angle_id, platform,
      ...fields,
      meta: { regenerated_at: new Date().toISOString(), direction: direction ?? null },
    });
    const seeded = await getCreative(sprint_id, angle_id, platform);
    if (!seeded) throw new Error('regenerateCreative: upsert did not persist');
    return seeded;
  }

  return patchCreative(sprint_id, angle_id, platform, fields);
}
