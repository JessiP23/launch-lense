// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sprint/[sprint_id]/creatives/[angle_id]/[platform]/regenerate
//
// Regenerates the user-facing copy for one (angle, platform) tuple via
// regenerateCreative(). Body (all optional):
//   { direction?: string }   — natural-language steering (e.g. "more urgent")
//
// Side effects:
//   - Patches sprint_creatives with new copy.
//   - Auto-demotes 'approved' → 'reviewing' (handled in patchCreative).
//   - Clears stale policy_severity / policy_issues.
//   - Emits creative_regenerated.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { regenerateCreative } from '@/lib/creatives/regenerate';
import { emitSprintEvent, SprintEventName } from '@/lib/analytics/events';
import type { Platform } from '@/lib/agents/types';

const PlatformSchema = z.enum(['meta', 'google', 'linkedin', 'tiktok']);
const BodySchema = z.object({
  direction: z.string().max(500).optional(),
});

type RouteParams = { sprint_id: string; angle_id: string; platform: string };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const { sprint_id, angle_id, platform } = await params;
  const pf = PlatformSchema.safeParse(platform);
  if (!pf.success) return Response.json({ error: 'Invalid platform' }, { status: 400 });
  const channel: Platform = pf.data;

  // Body is optional — empty POST is valid (regenerate without direction).
  let raw: unknown = {};
  try { raw = await req.json(); } catch { /* empty body is fine */ }
  const parsed = BodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const row = await regenerateCreative({
      sprint_id,
      angle_id,
      platform: channel,
      direction: parsed.data.direction,
    });

    void emitSprintEvent(sprint_id, SprintEventName.CreativeRegenerated, {
      angle_id,
      channel,
      direction: parsed.data.direction ?? null,
    });

    return Response.json({ creative: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to regenerate creative';
    const status = /not found/.test(msg) ? 404 : 500;
    return Response.json({ error: msg }, { status });
  }
}
