// POST /api/lp/track
// Ingests landing page conversion events from the injected tracking script.
// Public route (no auth — called from generated LP HTML pages).
//
// Tracked events: page_view, cta_click, scroll_depth, form_submit, email_capture
// All events are persisted to the events table AND emitted to PostHog.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { parseBody, LpTrackSchema } from '@/lib/schemas';
import { emitLpEvent, SprintEventName } from '@/lib/analytics/events';

const LP_EVENT_TO_POSTHOG: Record<string, string> = {
  page_view: SprintEventName.LpViewed,
  cta_click: SprintEventName.LpCtaClicked,
  scroll_depth: SprintEventName.LpScrollDepth,
  form_submit: SprintEventName.LpFormSubmitted,
  email_capture: SprintEventName.LpEmailCaptured,
};

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { data: body, error: parseError } = parseBody(LpTrackSchema, rawBody);
  if (parseError) return parseError;

  const recordId = body.sprint_id ?? body.test_id!;
  const db = createServiceClient();

  const eventPayload: Record<string, unknown> = {
    event: body.event,
    angle_id: body.angle_id,
    channel: body.channel,
    utm_source: body.utm_source,
    utm_medium: body.utm_medium,
    utm_campaign: body.utm_campaign,
    utm_content: body.utm_content,
    metadata: body.metadata,
    ts: body.ts ?? Date.now(),
  };

  // Write to events table (sprint or test)
  const insertPromise = body.sprint_id
    ? db.from('sprint_events').insert({
        sprint_id: body.sprint_id,
        agent: 'lp',
        event_type: body.event,
        channel: body.channel ?? null,
        payload: eventPayload,
      })
    : db.from('events').insert({
        test_id: body.test_id,
        type: body.event,
        payload: eventPayload,
      });

  // Emit to PostHog
  const posthogEventName = LP_EVENT_TO_POSTHOG[body.event] ?? body.event;
  const emitPromise = emitLpEvent(recordId, posthogEventName as Parameters<typeof emitLpEvent>[1], {
    sprint_id: body.sprint_id,
    test_id: body.test_id,
    angle_id: body.angle_id,
    channel: body.channel,
    utm_source: body.utm_source,
    utm_medium: body.utm_medium,
    utm_campaign: body.utm_campaign,
    utm_content: body.utm_content,
    ...(body.metadata ?? {}),
  } as never);

  // Fire both in parallel; swallow errors (LP tracking must never break the LP)
  await Promise.allSettled([insertPromise, emitPromise]);

  return Response.json({ ok: true });
}
