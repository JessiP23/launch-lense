// POST /api/sprint/[sprint_id]/video-brief — TikTok video creative brief from angles (Groq)

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { runVideoBriefAgent } from '@/lib/agents/video-brief';
import { captureServerEvent } from '@/lib/analytics/server-posthog';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> },
) {
  const { sprint_id } = await params;
  const db = createServiceClient();
  const { data: sprint, error } = await db.from('sprints').select('*').eq('id', sprint_id).single();
  if (error || !sprint) return Response.json({ error: 'Sprint not found' }, { status: 404 });

  const angles = sprint.angles as { angles?: Array<{ copy?: { tiktok?: { hook?: string; overlay?: string } } }> } | null;
  const first = angles?.angles?.[0];
  const tiktok = first?.copy?.tiktok;
  if (!tiktok?.hook) {
    return Response.json({ error: 'Angels/TikTok copy missing — complete Angles first' }, { status: 409 });
  }

  try {
    const brief = await runVideoBriefAgent({
      idea: sprint.idea as string,
      tiktok_hook: tiktok.hook,
      tiktok_overlay: tiktok.overlay ?? '',
    });
    await captureServerEvent(sprint_id, 'video_creative_generated', { sprint_id, channel: 'tiktok' });
    return Response.json({ brief });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Video brief failed';
    return Response.json({ error: msg }, { status: 500 });
  }
}
