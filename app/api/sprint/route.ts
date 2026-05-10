// POST /api/sprint — Create a new sprint (IDLE state)
// GET  /api/sprint — List all sprints for the org

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import type { Platform } from '@/lib/agents/types';
import { captureServerEvent } from '@/lib/analytics/server-posthog';

const ALL_CHANNELS: Platform[] = ['meta', 'google', 'linkedin', 'tiktok'];

export async function POST(request: NextRequest) {
  const db = createServiceClient();
  try {
    const body = await request.json() as {
      idea?: string;
      channels?: Platform[];
      budget_cents?: number;
      org_id?: string;
    };

    const { idea, channels, budget_cents = 50000, org_id } = body;

    if (!idea || typeof idea !== 'string' || idea.trim().length < 5) {
      return Response.json({ error: 'idea must be a non-empty string (min 5 chars)' }, { status: 400 });
    }

    const active_channels = (channels ?? ALL_CHANNELS).filter((c) =>
      ALL_CHANNELS.includes(c)
    );

    const { data, error } = await db
      .from('sprints')
      .insert({
        idea: idea.trim(),
        state: 'IDLE',
        active_channels,
        budget_cents,
        ...(org_id ? { org_id } : {}),
      })
      .select('id, idea, state, active_channels, budget_cents, created_at')
      .single();

    if (error || !data) {
      return Response.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
    }

    // Log sprint creation event
    await db.from('sprint_events').insert({
      sprint_id: data.id,
      agent: 'orchestrator',
      event_type: 'created',
      payload: { idea: idea.trim(), channels: active_channels, budget_cents },
    });

    await captureServerEvent(data.id, 'sprint_created', {
      sprint_id: data.id,
      idea_length_chars: idea.trim().length,
      genome_enabled: true,
      channels_selected: active_channels,
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
