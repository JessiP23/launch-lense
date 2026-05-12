// POST /api/sprint — Create a new sprint (IDLE state)
// GET  /api/sprint — List all sprints for the org

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { parseBody, SprintCreateSchema } from '@/lib/schemas';
import { emitSprintEvent, SprintEventName } from '@/lib/analytics/events';
import type { Platform } from '@/lib/agents/types';

const ALL_CHANNELS: Platform[] = ['meta', 'google', 'linkedin', 'tiktok'];

export async function POST(request: NextRequest) {
  const db = createServiceClient();
  try {
    let rawBody: unknown;
    try { rawBody = await request.json(); } catch { rawBody = {}; }

    const { data: body, error: parseError } = parseBody(SprintCreateSchema, rawBody);
    if (parseError) return parseError;

    const active_channels = (body.channels ?? ALL_CHANNELS).filter((c) =>
      ALL_CHANNELS.includes(c)
    );

    const { data, error } = await db
      .from('sprints')
      .insert({
        idea: body.idea,
        state: 'IDLE',
        active_channels,
        budget_cents: body.budget_cents,
        ...(body.org_id ? { org_id: body.org_id } : {}),
      })
      .select('id, idea, state, active_channels, budget_cents, created_at')
      .single();

    if (error || !data) {
      return Response.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
    }

    await db.from('sprint_events').insert({
      sprint_id: data.id,
      agent: 'orchestrator',
      event_type: 'created',
      payload: { idea: body.idea, channels: active_channels, budget_cents: body.budget_cents },
    });

    await emitSprintEvent(data.id, SprintEventName.SprintCreated, {
      idea_length_chars: body.idea.length,
      channels_selected: active_channels,
      budget_cents: body.budget_cents,
      org_id: body.org_id,
    });

    return Response.json({ sprint_id: data.id, ...data }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/sprint]', err);
    return Response.json({ error: 'Failed to create sprint' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const db = createServiceClient();
  try {
    const url = new URL(request.url);
    const org_id = url.searchParams.get('org_id');

    let query = db
      .from('sprints')
      .select('id, idea, state, active_channels, budget_cents, verdict, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (org_id) query = query.eq('org_id', org_id);

    const { data, error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ sprints: data ?? [] });
  } catch (err) {
    console.error('[GET /api/sprint]', err);
    return Response.json({ error: 'Failed to list sprints' }, { status: 500 });
  }
}
