// ─────────────────────────────────────────────────────────────────────────────
// GTM Package Generator — Concrete, actionable GTM starter plan
// Runs after ICP discovery completes, as part of the sprint completion sequence.
// Generates 30/60/90 day plans, ad headlines, budget scaling, and competitive wedge.
// ─────────────────────────────────────────────────────────────────────────────

import { callGroqJSON } from '@/lib/groq';
import { createServiceClient } from '@/lib/supabase';
import type { GenomeAgentOutput, VerdictAgentOutput, AngleAgentOutput, CampaignAgentOutput } from './types';
import type { ICPDiscoveryResult } from './icp-discovery';

// ── Types ───────────────────────────────────────────────────────────────────

export interface GTMPackage {
  sprint_id: string;
  thirty_day_plan: string[];
  sixty_day_plan: string[];
  ninety_day_plan: string[];
  next_ad_headlines: string[];
  recommended_budget_scale: string;
  primary_channel: string;
  channels_to_deprioritize: string[];
  the_beachhead: string;
  competitive_wedge: string;
  generated_at: string;
}

// ── Main GTM Package Function ───────────────────────────────────────────────

export async function generateGTMPackage(sprintId: string): Promise<GTMPackage> {
  const db = createServiceClient();

  // Fetch sprint data
  const { data: sprint, error: sprintError } = await db
    .from('sprints')
    .select('idea, genome, verdict, angles, campaign, icp_discovery')
    .eq('id', sprintId)
    .single();

  if (sprintError || !sprint) {
    throw new Error(`Sprint ${sprintId} not found`);
  }

  const genome = sprint.genome as GenomeAgentOutput | null;
  const verdict = sprint.verdict as VerdictAgentOutput | null;
  const angles = sprint.angles as AngleAgentOutput | null;
  const campaign = sprint.campaign as Record<string, CampaignAgentOutput> | null;
  const icpDiscovery = sprint.icp_discovery as ICPDiscoveryResult | null;

  if (!genome || !verdict || !angles || !campaign || !icpDiscovery) {
    throw new Error(`Sprint ${sprintId} missing required data for GTM package generation`);
  }

  // Extract key metrics
  const bestChannel = verdict.recommended_channel ?? 'meta';
  const bestChannelEntry = verdict.per_channel.find((c) => c.channel === bestChannel);
  const ctr = (verdict.aggregate_metrics.weighted_blended_ctr * 100).toFixed(2);
  const cpa = bestChannelEntry?.total_spend_cents && bestChannelEntry?.clicks > 0
    ? (bestChannelEntry.total_spend_cents / bestChannelEntry.clicks / 100).toFixed(2)
    : 'N/A';

  // Get best performing angle
  const crossChannelWinner = verdict.cross_channel_winning_angle;
  const bestAngleData = angles.angles.find((a) => a.id === crossChannelWinner);
  const bestHeadline = bestAngleData?.copy.meta?.headline ?? 'N/A';

  // Get first ICP segment
  const primarySegment = icpDiscovery.segments[0]?.segment_name ?? 'N/A';

  // Build Groq prompt
  const userPrompt = `Idea: ${sprint.idea}
Verdict: ${verdict.verdict} (${verdict.confidence}% confidence)
Best channel: ${bestChannel}
Best performing angle: ${bestHeadline}
ICP segment 1: ${primarySegment}
Campaign CTR: ${ctr}%
CPA achieved: $${cpa}

Generate a GTM package with:
1. thirty_day_plan: 3 specific actions for the next 30 days, each with a concrete deliverable
2. sixty_day_plan: 3 actions for days 31-60
3. ninety_day_plan: 3 actions for days 61-90
4. next_ad_headlines: 3 new ad headlines to test in the next sprint, based on what performed
5. recommended_budget_scale: how much to spend in the next sprint given these results
6. primary_channel: which single channel to double down on and why
7. channels_to_deprioritize: which channels to pause and why
8. the_beachhead: one specific segment + channel + message combination to own first
9. competitive_wedge: what makes this idea defensible based on the market research

Respond ONLY in JSON. No preamble.`;

  const systemPrompt = `You are a startup GTM strategist. Generate a concrete, actionable GTM starter plan based on validated ad performance data. Be specific. No platitudes. Every recommendation must reference the actual campaign data.`;

  let groqResponse: GTMPackage;
  try {
    groqResponse = await callGroqJSON<GTMPackage>(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { temperature: 0.4, max_tokens: 1200 }
    );
  } catch (err) {
    console.error('[GTM Package] Groq call failed:', err);
    throw new Error('GTM Package generation failed');
  }

  // Add metadata
  const result: GTMPackage = {
    ...groqResponse,
    sprint_id: sprintId,
    generated_at: new Date().toISOString(),
  };

  // Persist GTM package
  await db
    .from('sprints')
    .update({ gtm_package: result as unknown as Record<string, unknown> })
    .eq('id', sprintId);

  // Write sprint event
  await db.from('sprint_events').insert({
    sprint_id: sprintId,
    agent: 'gtm_package',
    event_type: 'gtm_package_complete',
    payload: {},
  });

  return result;
}
