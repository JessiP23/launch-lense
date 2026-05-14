// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sprint/[sprint_id]/creatives/[angle_id]/[platform]/scan
//
// Runs the policy scanner against the *persisted* sprint_creatives row
// (never trusting client-supplied copy) and writes the result back so the
// canvas can show a stable verdict + the approval guard can rely on it.
//
// Use POST /api/policy/scan for stateless previews while the user types.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCreative, recordPolicyScan } from '@/lib/creatives/store';
import { scanCreative } from '@/lib/policy/scan';
import { emitSprintEvent, SprintEventName } from '@/lib/analytics/events';
import type { Platform } from '@/lib/agents/types';

const PlatformSchema = z.enum(['meta', 'google', 'linkedin', 'tiktok']);

type RouteParams = { sprint_id: string; angle_id: string; platform: string };

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const { sprint_id, angle_id, platform } = await params;
  const pf = PlatformSchema.safeParse(platform);
  if (!pf.success) return Response.json({ error: 'Invalid platform' }, { status: 400 });
  const channel: Platform = pf.data;

  // Rows are eagerly seeded at angle-generation time (see lib/creatives/
  // seed.ts) so the row is guaranteed to exist by the time the user can
  // click Scan. We read the canonical row and feed it straight to the
  // scanner — no fallbacks, no merging.
  const row = await getCreative(sprint_id, angle_id, channel);
  if (!row) return Response.json({ error: 'Creative not found' }, { status: 404 });

  const result = scanCreative({
    platform: channel,
    headline: row.headline ?? undefined,
    primary_text: row.primary_text ?? undefined,
    description: row.description ?? undefined,
    cta: row.cta ?? undefined,
    display_link: row.display_link ?? undefined,
    hook: row.hook ?? undefined,
    overlay_text: row.overlay_text ?? undefined,
    callout: row.callout ?? undefined,
    audience_label: row.audience_label ?? undefined,
    image_url: row.image_url ?? undefined,
    video_url: row.video_url ?? undefined,
  });

  try {
    const row = await recordPolicyScan(
      sprint_id,
      angle_id,
      channel,
      result.severity,
      result.issues
    );

    void emitSprintEvent(sprint_id, SprintEventName.CreativePolicyScanned, {
      angle_id,
      channel,
      severity: result.severity,
      issue_count: result.issues.length,
      blocked: result.blocked,
    });

    return Response.json({
      creative: row,
      severity: result.severity,
      issues: result.issues,
      blocked: result.blocked,
      scanned_at: result.scanned_at,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to persist scan' },
      { status: 500 }
    );
  }
}
