// POST /api/sprint/[sprint_id]/demo-complete
// Completes the visual sprint path with deterministic demo landing, campaign,
// verdict, and report data after Genome/Healthgate/Angles have run.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { runVerdictAgent } from '@/lib/agents/verdict';
import type {
  AngleMetrics,
  CampaignAgentOutput,
  LandingAgentOutput,
  Platform,
  SprintRecord,
} from '@/lib/agents/types';

type DbSprintRecord = SprintRecord & { id?: string };

const CHANNEL_MULTIPLIER: Record<Platform, number> = {
  meta: 1,
  google: 1.65,
  linkedin: 0.32,
  tiktok: 0.82,
};
const ALL_CHANNELS: Platform[] = ['meta', 'google', 'linkedin', 'tiktok'];

function buildLanding(sprint: SprintRecord): LandingAgentOutput {
  const selectedAngleId = (sprint.angles as { selected_angle_id?: string } | undefined)?.selected_angle_id;
  const selectedAngle = sprint.angles!.angles.find((angle) => angle.id === selectedAngleId) ?? sprint.angles!.angles[0];
  return {
    pages: [{
      angle_id: selectedAngle.id,
      utm_base: `utm_campaign=${sprint.sprint_id}&utm_content=${selectedAngle.id}`,
      html: '',
      sections: [
        {
          type: 'hero',
          headline: selectedAngle.copy.meta.headline,
          subheadline: selectedAngle.copy.meta.body,
          cta_label: selectedAngle.cta,
        },
        {
          type: 'proof',
          bullets: [
            'Genome market structure scored before spend',
            'Healthgate protects the channel data quality',
            'Angle isolation shows which message is worth building around',
          ],
        },
        { type: 'form', headline: 'Join the validation list', cta_label: selectedAngle.cta },
        {
          type: 'trust',
          quote: 'A sprint should produce a decision, not another dashboard.',
          quote_attribution: 'LaunchLense validation report',
        },
      ],
    }],
  };
}

function buildCampaigns(sprint: SprintRecord): Record<Platform, CampaignAgentOutput> {
  const active: Platform[] = sprint.active_channels.length ? sprint.active_channels : ALL_CHANNELS;
  const budgetPerChannel = Math.floor(sprint.budget_cents / active.length);
  const startedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const sprintId = sprint.sprint_id;
  const selectedAngleId = (sprint.angles as { selected_angle_id?: string } | undefined)?.selected_angle_id;
  const selectedAngles = [sprint.angles!.angles.find((angle) => angle.id === selectedAngleId) ?? sprint.angles!.angles[0]];

  return Object.fromEntries(
    active.map((channel) => {
      const channelMultiplier = CHANNEL_MULTIPLIER[channel];
      const angleMetrics = selectedAngles.map((angle, index): AngleMetrics => {
        const spend_cents = budgetPerChannel;
        const impressions = Math.round((6200 - index * 900) * (channel === 'linkedin' ? 0.28 : 1));
        const ctr = Number(((0.022 - index * 0.004) * channelMultiplier).toFixed(4));
        const clicks = Math.max(1, Math.round(impressions * ctr));
        return {
          id: angle.id,
          impressions,
          clicks,
          ctr,
          cpc_cents: Math.max(85, Math.round(spend_cents / clicks)),
          spend_cents,
          status: index === 2 && channel === 'meta' ? 'PAUSED' : 'PASS',
        };
      });

      return [
        channel,
        {
          channel,
          status: 'COMPLETE',
          campaign_id: `demo_${channel}_${sprintId.slice(0, 8)}`,
          campaign_start_time: startedAt,
          budget_cents: budgetPerChannel,
          spent_cents: angleMetrics.reduce((sum, metric) => sum + metric.spend_cents, 0),
          angle_metrics: angleMetrics,
          last_polled_at: new Date().toISOString(),
        } satisfies CampaignAgentOutput,
      ];
    })
  ) as Record<Platform, CampaignAgentOutput>;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;
  const db = createServiceClient();

  const { data, error } = await db.from('sprints').select('*').eq('id', sprint_id).single();
  if (error || !data) return Response.json({ error: 'Sprint not found' }, { status: 404 });

  const rawSprint = data as DbSprintRecord;
  const sprint: SprintRecord = {
    ...rawSprint,
    sprint_id: rawSprint.sprint_id ?? rawSprint.id ?? sprint_id,
    active_channels: rawSprint.active_channels?.length ? rawSprint.active_channels : ALL_CHANNELS,
    budget_cents: rawSprint.budget_cents ?? 50000,
  };
  if (!sprint.angles?.angles?.length) {
    return Response.json({ error: 'Angles must be generated before demo completion' }, { status: 409 });
  }

  const landing = buildLanding(sprint);
  const campaign = buildCampaigns(sprint);

  const { data: benchRow } = await db
    .from('benchmarks')
    .select('avg_ctr, avg_cvr, avg_cpa_cents')
    .eq('vertical', 'saas')
    .maybeSingle();

  const verdict = await runVerdictAgent(campaign, {
    genome: sprint.genome,
    angles: sprint.angles,
    sprint_budget_cents: sprint.budget_cents,
    sprint_created_at: sprint.created_at,
    landing_conversion_rate: 0.048,
    benchmark_avg_ctr: benchRow?.avg_ctr != null ? Number(benchRow.avg_ctr) : null,
    benchmark_avg_cvr: benchRow?.avg_cvr != null ? Number(benchRow.avg_cvr) : null,
    benchmark_avg_cpc_cents: benchRow?.avg_cpa_cents != null ? Number(benchRow.avg_cpa_cents) : null,
  });
  const report = {
    sprint_id,
    pdf_url: null,
    generated_at: new Date().toISOString(),
    html: `<h1>${verdict.verdict}</h1><p>${verdict.reasoning}</p>`,
  };

  const { data: updated, error: updateError } = await db
    .from('sprints')
    .update({
      landing,
      campaign,
      verdict,
      report,
      state: 'COMPLETE',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sprint_id)
    .select('*')
    .single();

  if (updateError || !updated) {
    return Response.json({ error: updateError?.message ?? 'Failed to complete demo sprint' }, { status: 500 });
  }

  await db.from('sprint_events').insert([
    { sprint_id, agent: 'landing', event_type: 'completed', payload: { pages: landing.pages.length } },
    { sprint_id, agent: 'campaign', event_type: 'completed', payload: { channels: Object.keys(campaign) } },
    { sprint_id, agent: 'verdict', event_type: 'completed', payload: { verdict: verdict.verdict } },
    { sprint_id, agent: 'report', event_type: 'completed', payload: { generated: true } },
  ]);

  return Response.json({ sprint: updated });
}
