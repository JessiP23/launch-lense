// GET /api/sprint/[sprint_id] — Retrieve full sprint state

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

const MAX_INLINE_CREATIVE_IMAGE_CHARS = 250_000;

function sanitizeAnglesPatch(angles: unknown): unknown {
  if (!angles || typeof angles !== 'object' || Array.isArray(angles)) return angles;
  const source = angles as Record<string, unknown>;
  const assets = source.creative_assets;
  if (!assets || typeof assets !== 'object' || Array.isArray(assets)) return angles;

  const sanitizedAssets: Record<string, unknown> = {};
  for (const [channel, asset] of Object.entries(assets as Record<string, unknown>)) {
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
      sanitizedAssets[channel] = asset;
      continue;
    }

    const nextAsset = { ...(asset as Record<string, unknown>) };
    const image = nextAsset.image;
    if (
      typeof image === 'string' &&
      image.startsWith('data:') &&
      image.length > MAX_INLINE_CREATIVE_IMAGE_CHARS
    ) {
      nextAsset.image = null;
    }
    sanitizedAssets[channel] = nextAsset;
  }

  return { ...source, creative_assets: sanitizedAssets };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;
  const db = createServiceClient();

  const [sprintResult, eventsResult] = await Promise.all([
    db.from('sprints').select('*').eq('id', sprint_id).single(),
    db
      .from('sprint_events')
      .select('agent, event_type, channel, payload, created_at')
      .eq('sprint_id', sprint_id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const { data, error } = sprintResult;
  if (error || !data) {
    return Response.json({ error: 'Sprint not found' }, { status: 404 });
  }

  const events = eventsResult.error ? [] : (eventsResult.data ?? []);

  return Response.json({ ...data, events });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;
  const db = createServiceClient();
  const body = await req.json().catch(() => ({})) as {
    angles?: unknown;
    landing?: unknown;
    integrations?: unknown;
    post_sprint?: unknown;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.angles) patch.angles = sanitizeAnglesPatch(body.angles);
  if (body.landing) patch.landing = body.landing;
  if (body.integrations) patch.integrations = body.integrations;
  if (body.post_sprint) patch.post_sprint = body.post_sprint;

  if (!body.angles && !body.landing && !body.integrations && !body.post_sprint) {
    return Response.json({ error: 'No supported sprint fields provided' }, { status: 400 });
  }

  const { data, error } = await db
    .from('sprints')
    .update(patch)
    .eq('id', sprint_id)
    .select('*')
    .single();

  if (error || !data) {
    return Response.json({ error: error?.message ?? 'Failed to update sprint' }, { status: 500 });
  }

  // Audit trail — do not block the HTTP response on a second round-trip.
  void db
    .from('sprint_events')
    .insert({
      sprint_id,
      agent: 'orchestrator',
      event_type: 'edited',
      payload: { fields: Object.keys(patch).filter((key) => key !== 'updated_at') },
    })
    .then(({ error: insertErr }) => {
      if (insertErr) console.error('[PATCH /api/sprint] sprint_events:', insertErr.message);
    });

  return Response.json({ sprint: data });
}
