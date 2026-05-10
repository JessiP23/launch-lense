// POST /api/sprint/[sprint_id]/campaign/start
// Records the channel launch and starts the 48-hour monitoring window.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { dispatchCampaignStart } from '@/lib/sprint-machine';
import type { Platform, CampaignAgentOutput } from '@/lib/agents/types';
import { createServiceClient } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/analytics/server-posthog';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;
  try {
    const body = await req.json().catch(() => ({})) as {
      campaign_ids?: Partial<Record<Platform, string>>;
    };

    const channels: Platform[] = ['meta', 'google', 'linkedin', 'tiktok'];
    const campaignData: Partial<Record<Platform, Partial<Pick<CampaignAgentOutput, 'campaign_id' | 'campaign_start_time' | 'budget_cents'>>>> = {};

    for (const channel of channels) {
      campaignData[channel] = {
        campaign_id: body.campaign_ids?.[channel] ?? `launch_${channel}_${sprint_id.slice(0, 8)}`,
        campaign_start_time: new Date().toISOString(),
      };
    }

    const sprint = await dispatchCampaignStart(sprint_id, campaignData);
    const db = createServiceClient();
    const { data: row } = await db.from('sprints').select('active_channels, budget_cents, angles').eq('id', sprint_id).single();
    await captureServerEvent(sprint_id, 'campaign_launched', {
      sprint_id,
      channel: 'multi',
      budget_usd: (row?.budget_cents ?? 0) / 100,
      angle_count: Array.isArray((row?.angles as { angles?: unknown[] } | null)?.angles)
        ? (row!.angles as { angles: unknown[] }).angles.length
        : 0,
    });
    return Response.json({ sprint });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Campaign launch failed' }, { status: 500 });
  }
}
