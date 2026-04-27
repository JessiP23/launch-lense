// ─────────────────────────────────────────────────────────────────────────────
// AngleAgent — 3 distinct ad angles, adapted per channel
// Input: Genome output (ICP, proceed_note, unique_mechanism)
// Output: 3 angles, each with copy for Meta · Google · LinkedIn · TikTok
// Rules:
//   - Each angle = different archetype (PAIN | ASPIRATION | SOCIAL_PROOF | CURIOSITY | AUTHORITY)
//   - No two angles share more than 2 consecutive words in headlines
//   - TikTok hook: first 3 words must create open loop or tension
//   - LinkedIn: lead with professional outcome, not product feature
//   - Google: reflect what someone literally types into search
//   - Meta: copy supports an image, it does not explain it
// ─────────────────────────────────────────────────────────────────────────────

import { callGroqJSON } from '@/lib/groq';
import type {
  AngleAgentOutput,
  Angle,
  AngleArchetype,
  AngleEmotionalLever,
  Platform,
} from './types';
import type { GenomeAgentOutput } from './types';

const SYSTEM = `You are AngleAgent inside LaunchLense. Your job is to generate 3 distinct, production-ready ad angles for a startup idea.
Rules:
- Each angle uses a DIFFERENT archetype: PAIN, ASPIRATION, SOCIAL_PROOF, CURIOSITY, or AUTHORITY. No two angles share an archetype.
- Each angle uses a DIFFERENT emotional lever: fear, ambition, relief, intrigue, trust. No two angles share a lever.
- No two angle headlines may share more than 2 consecutive words.
- All copy respects channel-specific character limits exactly.
- TikTok hooks: first 3 words MUST create open loop, tension, or shock.
- LinkedIn copy: lead with professional outcome (result, efficiency, cost, promotion) — never with product features.
- Google copy: match buyer search intent — reflect the exact words someone types when ready to buy.
- Meta copy: copy supports an image — it does NOT explain it. The image does the visual work.
Return ONLY valid JSON. No prose. No markdown fences.`;

function buildUserPrompt(params: {
  idea: string;
  icp: string;
  problem_statement: string;
  solution_wedge: string;
  unique_mechanism: string;
  proceed_note: string | null;
  active_channels: Platform[];
}): string {
  const { idea, icp, problem_statement, solution_wedge, unique_mechanism, proceed_note, active_channels } = params;

  return `Generate 3 distinct ad angles for this startup idea.

IDEA: "${idea}"
ICP (exact buyer): "${icp}"
PROBLEM: "${problem_statement}"
SOLUTION WEDGE: "${solution_wedge}"
UNIQUE MECHANISM: "${unique_mechanism}"
WHAT TO EMPHASIZE (from Genome research): "${proceed_note ?? 'Unknown — use your best judgment'}"
ACTIVE CHANNELS: ${active_channels.join(', ')}

Required archetypes: PAIN, ASPIRATION, SOCIAL_PROOF (use exactly these three across the 3 angles in any order).
Required emotional levers: fear, ambition, relief (one per angle, no repeats).

Return this exact JSON structure:
{
  "icp": "<one sentence — exact buyer, title, trigger event>",
  "value_prop": "<one sentence — the core value proposition>",
  "angles": [
    {
      "id": "angle_A",
      "archetype": "PAIN",
      "emotional_lever": "fear",
      "copy": {
        "meta": {
          "headline": "<≤40 chars — visual-led, supports an image>",
          "body": "<≤125 chars — completes the image, does not explain it>"
        },
        "google": {
          "headline1": "<≤30 chars — reflects literal buyer search query>",
          "headline2": "<≤30 chars — benefit or differentiator>",
          "description": "<≤90 chars — purchase-intent focused>"
        },
        "linkedin": {
          "intro": "<≤70 chars — professional outcome first, not feature>",
          "headline": "<≤25 chars — direct result>",
          "body": "<≤150 chars — ROI or efficiency angle for professional buyer>"
        },
        "tiktok": {
          "hook": "<≤100 chars — first 3 words MUST create open loop or tension>",
          "overlay": "<≤80 chars — CTA overlay text>"
        }
      },
      "cta": "<verb-first, outcome-focused, ≤5 words>"
    },
    {
      "id": "angle_B",
      "archetype": "ASPIRATION",
      "emotional_lever": "ambition",
      "copy": { ... same structure ... }
      "cta": "..."
    },
    {
      "id": "angle_C",
      "archetype": "SOCIAL_PROOF",
      "emotional_lever": "relief",
      "copy": { ... same structure ... },
      "cta": "..."
    }
  ]
}

Enforce character limits strictly. Count characters. Truncate before exceeding.`;
}

// ── Runner ─────────────────────────────────────────────────────────────────

export async function runAngleAgent(params: {
  idea: string;
  genome: GenomeAgentOutput;
  active_channels: Platform[];
}): Promise<AngleAgentOutput> {
  const { idea, genome, active_channels } = params;

  const raw = await callGroqJSON<{
    icp: string;
    value_prop: string;
    angles: Array<{
      id: string;
      archetype: string;
      emotional_lever: string;
      copy: {
        meta: { headline: string; body: string };
        google: { headline1: string; headline2: string; description: string };
        linkedin: { intro: string; headline: string; body: string };
        tiktok: { hook: string; overlay: string };
      };
      cta: string;
    }>;
  }>(
    [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: buildUserPrompt({
          idea,
          icp: genome.icp,
          problem_statement: genome.problem_statement,
          solution_wedge: genome.solution_wedge,
          unique_mechanism: genome.unique_mechanism,
          proceed_note: genome.proceed_note,
          active_channels,
        }),
      },
    ],
    { temperature: 0.7, max_tokens: 2000 }
  );

  const s = (v: unknown, max: number) => String(v ?? '').slice(0, max);
  const ids: Array<'angle_A' | 'angle_B' | 'angle_C'> = ['angle_A', 'angle_B', 'angle_C'];
  const archetypes: AngleArchetype[] = ['PAIN', 'ASPIRATION', 'SOCIAL_PROOF'];
  const levers: AngleEmotionalLever[] = ['fear', 'ambition', 'relief'];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchlense.com';

  const angles: [Angle, Angle, Angle] = (raw.angles ?? []).slice(0, 3).map((a, i) => {
    const id = ids[i];
    const utm_tags: Record<Platform, string> = {
      meta:     `utm_source=meta&utm_medium=paid&utm_campaign=sprint&utm_content=${id}`,
      google:   `utm_source=google&utm_medium=cpc&utm_campaign=sprint&utm_content=${id}`,
      linkedin: `utm_source=linkedin&utm_medium=paid&utm_campaign=sprint&utm_content=${id}`,
      tiktok:   `utm_source=tiktok&utm_medium=paid&utm_campaign=sprint&utm_content=${id}`,
    };

    return {
      id,
      archetype: (archetypes[i]) as AngleArchetype,
      emotional_lever: (levers[i]) as AngleEmotionalLever,
      copy: {
        meta: {
          headline: s(a.copy?.meta?.headline, 40),
          body:     s(a.copy?.meta?.body, 125),
        },
        google: {
          headline1:   s(a.copy?.google?.headline1, 30),
          headline2:   s(a.copy?.google?.headline2, 30),
          description: s(a.copy?.google?.description, 90),
        },
        linkedin: {
          intro:    s(a.copy?.linkedin?.intro, 70),
          headline: s(a.copy?.linkedin?.headline, 25),
          body:     s(a.copy?.linkedin?.body, 150),
        },
        tiktok: {
          hook:    s(a.copy?.tiktok?.hook, 100),
          overlay: s(a.copy?.tiktok?.overlay, 80),
        },
      },
      cta: s(a.cta, 40),
      utm_tags,
    } satisfies Angle;
  }) as [Angle, Angle, Angle];

  return {
    angles,
    icp: String(raw.icp ?? genome.icp),
    value_prop: String(raw.value_prop ?? ''),
  };
}
