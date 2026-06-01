// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — GTM Package Agent
//
// Generates a concrete 90-day GTM plan based on sprint results, ICP discovery,
// and verdict. Provides actionable next steps for scaling the validated idea.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase';
import { callGroq } from '@/lib/groq';
import { getSprint } from '@/lib/sprint-machine';
import { runICPDiscovery } from './icp-discovery';

// ── Types ─────────────────────────────────────────────────────────────────

export interface GTMPackageOutput {
  thirty_day_plan: string[];
  sixty_day_plan: string[];
  ninety_day_plan: string[];
  next_ad_headlines: string[];
  recommended_budget_scale: string;
  primary_channel: string;
  primary_channel_reason: string;
  channels_to_deprioritize: string[];
  the_beachhead: string;
  competitive_wedge: string;
}

// ── Main runner ────────────────────────────────────────────────────────────

export async function generateGTMPackage(sprintId: string): Promise<void> {
  const db = createServiceClient();

  // Step 1: Read the sprint
  const sprint = await getSprint(sprintId);
  if (!sprint) {
    console.error(`[gtm-package] Sprint ${sprintId} not found`);
    return;
  }

  // Step 2: If already populated, return early
  if ((sprint as any).gtm_package) {
    console.log(`[gtm-package] Sprint ${sprintId} already has gtm_package, skipping`);
    return;
  }

  // Step 3: If icp_discovery is null, wait — call runICPDiscovery first
  if (!(sprint as any).icp_discovery) {
    console.log(`[gtm-package] Sprint ${sprintId} missing icp_discovery, running ICP discovery first`);
    await runICPDiscovery(sprintId);
    // Re-read sprint to get updated data
    const updatedSprint = await getSprint(sprintId);
    if (!updatedSprint) return;
  }

  // Step 4: Identify best_channel, best_angle, achieved_cpa, achieved_ctr from campaign data
  const bestChannel = sprint.active_channels[0] || 'meta';
  const bestAngle = sprint.angles?.angles?.[0]?.archetype || 'unknown';
  
  let achievedCPA: number | null = null;
  let achievedCTR: number | null = null;
  
  if (sprint.campaign?.meta?.angle_metrics) {
    const totalSpend = sprint.campaign.meta.angle_metrics.reduce((sum: number, m: any) => sum + (m.spend_cents || 0), 0);
    const totalClicks = sprint.campaign.meta.angle_metrics.reduce((sum: number, m: any) => sum + (m.clicks || 0), 0);
    const totalImpressions = sprint.campaign.meta.angle_metrics.reduce((sum: number, m: any) => sum + (m.impressions || 0), 0);
    
    achievedCPA = totalClicks > 0 ? totalSpend / totalClicks : null;
    achievedCTR = totalImpressions > 0 ? totalClicks / totalImpressions : null;
  }

  // Step 5: Call Groq for GTM package
  let gtmOutput: GTMPackageOutput;
  try {
    gtmOutput = await generateGTMPackageWithGroq(
      sprint,
      bestChannel,
      bestAngle,
      achievedCPA,
      achievedCTR
    );
  } catch (err) {
    console.error(`[gtm-package] Groq generation failed for ${sprintId}:`, err);
    // Write failure event
    await db.from('sprint_events').insert({
      sprint_id: sprintId,
      agent: 'gtm-package',
      event_type: 'gtm_package_failed',
      payload: { error: String(err) },
    });
    return;
  }

  // Step 6: PATCH the sprint row
  await db
    .from('sprints')
    .update({ gtm_package: gtmOutput, updated_at: new Date().toISOString() })
    .eq('id', sprintId);

  // Step 7: Write sprint event
  await db.from('sprint_events').insert({
    sprint_id: sprintId,
    agent: 'gtm-package',
    event_type: 'gtm_package_complete',
    payload: {},
  });

  console.log(`[gtm-package] Completed for ${sprintId}`);
}

// ── Helper: Generate GTM Package with Groq ───────────────────────────────────

async function generateGTMPackageWithGroq(
  sprint: any,
  bestChannel: string,
  bestAngle: string,
  achievedCPA: number | null,
  achievedCTR: number | null
): Promise<GTMPackageOutput> {
  const system = 'You are a startup GTM strategist. Generate a concrete 90-day GTM plan. Return ONLY valid JSON. No preamble. No markdown.';

  const verdict = sprint.verdict?.verdict || 'UNKNOWN';
  const confidence = sprint.verdict?.confidence_score || 0;
  const icpSegment = (sprint as any).icp_discovery?.segments?.[0]?.segment_name || 'not identified';

  const userPrompt = `Idea: ${sprint.idea}
Verdict: ${verdict} (${confidence}% confidence)
Best channel: ${bestChannel}
Best angle: ${bestAngle}
Achieved CPA: ${achievedCPA !== null ? `$${(achievedCPA / 100).toFixed(2)}` : 'no data'}
Achieved CTR: ${achievedCTR !== null ? `${(achievedCTR * 100).toFixed(2)}%` : 'no data'}
ICP Segment 1: ${icpSegment}

Return JSON with this exact schema:
{
  "thirty_day_plan": ["action 1", "action 2", "action 3"],
  "sixty_day_plan": ["action 1", "action 2", "action 3"],
  "ninety_day_plan": ["action 1", "action 2", "action 3"],
  "next_ad_headlines": ["headline 1", "headline 2", "headline 3"],
  "recommended_budget_scale": "string explaining next sprint budget",
  "primary_channel": "channel name",
  "primary_channel_reason": "one sentence why",
  "channels_to_deprioritize": ["channel list"],
  "the_beachhead": "one segment + channel + message to own first",
  "competitive_wedge": "what makes this defensible"
}`;

  const content = await callGroq(
    [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ],
    { model: 'llama-3.3-70b-versatile', max_tokens: 1200, temperature: 0.3 }
  );

  // Strip markdown fences if present
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  }
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  try {
    return JSON.parse(jsonStr) as GTMPackageOutput;
  } catch (err) {
    throw new Error(`Failed to parse Groq response as JSON: ${jsonStr.slice(0, 200)}`);
  }
}
