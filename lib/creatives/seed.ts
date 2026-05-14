// ─────────────────────────────────────────────────────────────────────────────
// seedSprintCreatives
//
// Materialises one sprint_creatives row per (angle × active_channel) the
// moment angles are generated. Idempotent: any row that already exists is
// left untouched.
//
// Why eagerly seed:
//   - Every downstream action (scan, approve, regenerate, patch) reads the
//     row first. If rows are created lazily on first edit, all of these
//     routes need defensive "create on miss" branches — fan-out complexity
//     for no benefit.
//   - The client cache can then trust that every row it knows about
//     actually exists on the server, which lets us delete the optimistic-
//     stub + serverKeysRef bookkeeping in `useCreatives`.
//
// Called from:
//   - lib/sprint-machine.ts dispatchAngles, right after persisting angles.
//   - GET /api/sprint/[id]/creatives — idempotent backfill for sprints that
//     finished angles before this code shipped. Cheap because upsertCreative
//     no-ops when the row already exists with matching defaults.
// ─────────────────────────────────────────────────────────────────────────────

import { upsertCreative, getCreative } from './store';
import type {
  Angle,
  AngleAgentOutput,
  Platform,
  SprintCreativeEditable,
} from '@/lib/agents/types';

function copyFor(angle: Angle, platform: Platform): Partial<SprintCreativeEditable> {
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
        hook: angle.copy.tiktok.hook,
        overlay_text: angle.copy.tiktok.overlay,
        cta: angle.cta,
      };
  }
}

export async function seedSprintCreatives(
  sprintId: string,
  angles: AngleAgentOutput | null | undefined,
  activeChannels: Platform[],
): Promise<void> {
  if (!angles?.angles?.length || activeChannels.length === 0) return;

  // Serialise to keep request count bounded; the volume is tiny (<= 12).
  for (const angle of angles.angles) {
    for (const platform of activeChannels) {
      const existing = await getCreative(sprintId, angle.id, platform);
      if (existing) continue; // already materialised — preserve any user edits
      await upsertCreative({
        sprint_id: sprintId,
        angle_id: angle.id,
        platform,
        ...copyFor(angle, platform),
      });
    }
  }
}
