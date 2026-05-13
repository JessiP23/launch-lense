// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sprint/[sprint_id]/creatives/[angle_id]/[platform]/transition
//
// Single endpoint for every approval-related state change:
//   { to: 'approved' }                    — user approves the creative
//   { to: 'rejected', reason: '...' }     — user rejects (reason required)
//   { to: 'reviewing' }                   — re-opens an approved/rejected row
//   { to: 'draft' }                       — sends back to the editor
//
// Deployment transitions ('deploying' / 'deployed' / 'failed') are reserved
// for the orchestrator; this endpoint refuses them.
//
// On a successful 'approved' transition we also run the policy scanner once
// more as a server-side guard, so an approval cannot land if the copy now
// fails policy. This closes the race where the user edits, scan returns
// 'block', and the client still POSTs approve.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  getCreative,
  recordPolicyScan,
  transitionStatus,
} from '@/lib/creatives/store';
import { scanCreative } from '@/lib/policy/scan';
import { emitSprintEvent, SprintEventName } from '@/lib/analytics/events';
import type { Platform } from '@/lib/agents/types';

const PlatformSchema = z.enum(['meta', 'google', 'linkedin', 'tiktok']);
const TransitionSchema = z.object({
  to: z.enum(['draft', 'reviewing', 'approved', 'rejected']),
  reason: z.string().max(1000).optional(),
  actor: z.string().max(256).optional(),
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

  let raw: unknown;
  try { raw = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = TransitionSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.format() },
      { status: 400 }
    );
  }
  const { to, reason, actor } = parsed.data;

  const existing = await getCreative(sprint_id, angle_id, channel);
  if (!existing) return Response.json({ error: 'Creative not found' }, { status: 404 });

  // Server-side policy guard on approval. We re-scan from the persisted
  // fields so we never trust a stale client-side scan.
  if (to === 'approved') {
    const result = scanCreative({
      platform: channel,
      headline: existing.headline ?? undefined,
      primary_text: existing.primary_text ?? undefined,
      description: existing.description ?? undefined,
      cta: existing.cta ?? undefined,
      display_link: existing.display_link ?? undefined,
      hook: existing.hook ?? undefined,
      overlay_text: existing.overlay_text ?? undefined,
      callout: existing.callout ?? undefined,
      audience_label: existing.audience_label ?? undefined,
      image_url: existing.image_url ?? undefined,
      video_url: existing.video_url ?? undefined,
    });
    // Persist the fresh scan regardless of outcome so the UI sees the
    // current state, then short-circuit if blocked.
    try {
      await recordPolicyScan(sprint_id, angle_id, channel, result.severity, result.issues);
    } catch {/* non-fatal */}
    if (result.blocked) {
      return Response.json(
        {
          error: 'Approval blocked by policy scan',
          severity: result.severity,
          issues: result.issues,
        },
        { status: 409 }
      );
    }
  }

  try {
    const row = await transitionStatus(sprint_id, angle_id, channel, to, {
      actor,
      reason,
    });

    // Fire analytics for the canonical approval-workflow events. Fire-and-
    // forget — never block the HTTP response on instrumentation.
    const evtName =
      to === 'approved'
        ? SprintEventName.CreativeApproved
        : to === 'rejected'
          ? SprintEventName.CreativeRejected
          : SprintEventName.CreativeEdited;
    void emitSprintEvent(sprint_id, evtName, {
      angle_id,
      channel,
      to,
      actor: actor ?? null,
      reason: reason ?? null,
    });

    return Response.json({ creative: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to transition creative';
    const status = /illegal transition|reason required/.test(msg) ? 409 : 500;
    return Response.json({ error: msg }, { status });
  }
}
