import { getCreative } from '@/lib/creatives/store';
import { getSprint } from '@/lib/sprint-machine';
import type {
  Angle,
  Platform,
  SprintCreative,
  SprintRecord,
} from '@/lib/agents/types';
import type { PolicyScanInput } from '@/lib/policy/scan';

// Pick the platform-specific copy fallback off an angle. Mirrors the
// `fallbackFor` helper in `creative-approval-workspace.tsx`, kept in sync
// by hand because pulling that into a shared module would require turning
// it into a server-safe util and isn't worth it for four entries.
function copyFallback(angle: Angle | undefined, platform: Platform) {
  if (!angle) return {} as Partial<PolicyScanInput>;
  switch (platform) {
    case 'meta':
      return {
        headline: angle.copy.meta.headline,
        primary_text: angle.copy.meta.body,
        cta: angle.cta || 'LEARN_MORE',
      };
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
        cta: angle.cta,
      };
  }
}

function legacyImageFor(sprint: SprintRecord | null, platform: Platform): string | undefined {
  const assets = (sprint?.angles as
    | { creative_assets?: Partial<Record<Platform, { image?: string | null }>> }
    | undefined
  )?.creative_assets;
  const image = assets?.[platform]?.image;
  return image ? image : undefined;
}

/** Pick the first non-empty value among the candidates. */
function firstNonEmpty(...vals: Array<string | null | undefined>): string | undefined {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return undefined;
}

export interface HydratedScanContext {
  row: SprintCreative;
  input: PolicyScanInput;
}

/**
 * Loads the persisted row and merges in copy + image fallbacks so the
 * policy scanner sees the same data the user sees in the panel.
 *
 * Returns `null` if the row doesn't exist; callers should 404 in that case.
 */
export async function buildScanInput(
  sprintId: string,
  angleId: string,
  platform: Platform
): Promise<HydratedScanContext | null> {
  const row = await getCreative(sprintId, angleId, platform);
  if (!row) return null;

  const sprint = await getSprint(sprintId);
  const angle = sprint?.angles?.angles.find((a) => a.id === angleId);
  const fb = copyFallback(angle, platform);

  const input: PolicyScanInput = {
    platform,
    headline: firstNonEmpty(row.headline, fb.headline),
    primary_text: firstNonEmpty(row.primary_text, fb.primary_text),
    description: firstNonEmpty(row.description, fb.description),
    cta: firstNonEmpty(row.cta, fb.cta),
    display_link: row.display_link ?? undefined,
    hook: row.hook ?? undefined,
    overlay_text: row.overlay_text ?? undefined,
    callout: row.callout ?? undefined,
    audience_label: row.audience_label ?? undefined,
    image_url: firstNonEmpty(row.image_url, legacyImageFor(sprint, platform)),
    video_url: row.video_url ?? undefined,
  };

  return { row, input };
}
