// POST /api/lp/track
// Ingests landing page conversion events from the injected tracking script.
// Public route (no auth — called from generated LP HTML pages).
//
// Tracked events: page_view, cta_click, scroll_depth, form_submit, email_capture
// All events are persisted to the events table AND emitted to PostHog.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { parseBody, LpTrackSchema } from '@/lib/schemas';
import { emitLpEvent, SprintEventName } from '@/lib/analytics/events';
import { emitLpCapiEvent } from '@/lib/meta/conversions';

const LP_EVENT_TO_POSTHOG: Record<string, string> = {
  page_view: SprintEventName.LpViewed,
  cta_click: SprintEventName.LpCtaClicked,
  scroll_depth: SprintEventName.LpScrollDepth,
  form_submit: SprintEventName.LpFormSubmitted,
  email_capture: SprintEventName.LpEmailCaptured,
};

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip');
}

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

  const ip = clientIp(request);
  const userAgent = request.headers.get('user-agent');
  const metadata = (body.metadata ?? {}) as Record<string, unknown>;
  const rawEmail = typeof metadata.email === 'string' ? (metadata.email as string) : null;
  const emailHash = rawEmail
    ? createHash('sha256').update(rawEmail.trim().toLowerCase()).digest('hex')
    : null;

  const eventPayload: Record<string, unknown> = {
    event: body.event,
    event_id: body.event_id,
    angle_id: body.angle_id,
    channel: body.channel,
    utm_source: body.utm_source,
    utm_medium: body.utm_medium,
    utm_campaign: body.utm_campaign,
    utm_content: body.utm_content,
    fbclid: body.fbclid,
    fbc: body.fbc,
    fbp: body.fbp,
    page_url: body.page_url,
    // Never persist the raw email — only the hash, in metadata.email_hash.
    metadata: { ...metadata, ...(emailHash ? { email_hash: emailHash } : {}), email: undefined },
    ts: body.ts ?? Date.now(),
  };

  // 1. Legacy event row (sprint_events or events) for canvas + back-compat.
  const legacyInsert = body.sprint_id
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

  // 2. Normalized sprint_lp_events row (preferred going forward).
  const normalizedInsert = db.from('sprint_lp_events').insert({
    sprint_id: body.sprint_id ?? null,
    test_id: body.test_id ?? null,
    angle_id: body.angle_id ?? null,
    channel: body.channel ?? null,
    event_name: body.event,
    event_id: body.event_id ?? null,
    utm_source: body.utm_source ?? null,
    utm_medium: body.utm_medium ?? null,
    utm_campaign: body.utm_campaign ?? null,
    utm_content: body.utm_content ?? null,
    fbclid: body.fbclid ?? null,
    fbc: body.fbc ?? null,
    fbp: body.fbp ?? null,
    ip,
    user_agent: userAgent,
    email_hash: emailHash,
    page_url: body.page_url ?? null,
    metadata: eventPayload.metadata,
  });

  // 3. PostHog
  const posthogEventName = LP_EVENT_TO_POSTHOG[body.event] ?? body.event;
  const emitPromise = emitLpEvent(
    recordId,
    posthogEventName as Parameters<typeof emitLpEvent>[1],
    {
      sprint_id: body.sprint_id,
      test_id: body.test_id,
      angle_id: body.angle_id,
      channel: body.channel,
      utm_source: body.utm_source,
      utm_medium: body.utm_medium,
      utm_campaign: body.utm_campaign,
      utm_content: body.utm_content,
      ...(body.metadata ?? {}),
    } as never
  );

  // 4. Meta Conversions API — server-side mirror with shared event_id for dedup.
  const capiPromise = emitLpCapiEvent(body.event, {
    sprint_id: body.sprint_id,
    test_id: body.test_id,
    angle_id: body.angle_id,
    channel: body.channel,
    utm_source: body.utm_source,
    utm_medium: body.utm_medium,
    utm_campaign: body.utm_campaign,
    utm_content: body.utm_content,
    source_url: body.page_url,
    ip,
    user_agent: userAgent,
    fbclid: body.fbclid ?? null,
    fbc: body.fbc ?? null,
    fbp: body.fbp ?? null,
    email: rawEmail,
    event_id: body.event_id,
  });

  // Fire all in parallel; swallow errors — LP tracking must never break the LP.
  await Promise.allSettled([legacyInsert, normalizedInsert, emitPromise, capiPromise]);

  return Response.json({ ok: true });
}
