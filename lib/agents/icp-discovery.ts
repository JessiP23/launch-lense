// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — ICP Discovery Agent
//
// Analyzes real ad performance data to identify the 3 most specific customer
// segments based on who clicked, what angles resonated, and which channels
// performed best. Runs after sprint completes.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase';
import { callGroq, callGroqJSON } from '@/lib/groq';
import { getSprint } from '@/lib/sprint-machine';
import type { Platform } from './types';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ICPDiscoverySegment {
  segment_name: string;
  why_they_fit: string;
  where_to_find_them: string;
  estimated_segment_size: string;
  outreach_angle: string;
  urgency_signal: string;
}

export interface ICPDiscoveryOutput {
  segments: ICPDiscoverySegment[];
}

interface GTMIntent {
  explicit_target_mentioned: boolean;
  target_stage: string | null;
  target_role: string | null;
  target_industry: string | null;
  company_size: string | null;
}

// ── Main runner ────────────────────────────────────────────────────────────

export async function runICPDiscovery(sprintId: string): Promise<void> {
  const db = createServiceClient();

  // Step 1: Read the sprint
  const sprint = await getSprint(sprintId);
  if (!sprint) {
    console.error(`[icp-discovery] Sprint ${sprintId} not found`);
    return;
  }

  // Step 2: Check if already populated
  if ((sprint as any).icp_discovery) {
    console.log(`[icp-discovery] Sprint ${sprintId} already has icp_discovery, skipping`);
    return;
  }

  // Step 3: Parse GTM intent from idea using Groq
  let gtmIntent: GTMIntent;
  try {
    gtmIntent = await extractGTMIntent(sprint.idea);
  } catch (err) {
    console.warn(`[icp-discovery] GTM intent extraction failed for ${sprintId}:`, err);
    gtmIntent = {
      explicit_target_mentioned: false,
      target_stage: null,
      target_role: null,
      target_industry: null,
      company_size: null,
    };
  }

  // Step 4: Identify best performing angle and channel
  const bestAngle = sprint.angles?.angles?.[0]?.archetype || 'unknown';
  const bestHeadline = sprint.angles?.angles?.[0]?.copy?.meta?.headline || '';
  let bestChannel = sprint.active_channels[0] || 'meta';

  // Find channel with lowest CPA if campaign data exists
  let lowestCPAChannel = bestChannel;
  let lowestCPA: number | null = null;
  if (sprint.campaign) {
    for (const [ch, data] of Object.entries(sprint.campaign) as [Platform, any][]) {
      if (data?.angle_metrics) {
        const totalSpend = data.angle_metrics.reduce((sum: number, m: any) => sum + (m.spend_cents || 0), 0);
        const totalClicks = data.angle_metrics.reduce((sum: number, m: any) => sum + (m.clicks || 0), 0);
        const cpa = totalClicks > 0 ? totalSpend / totalClicks : null;
        if (cpa !== null && (lowestCPA === null || cpa < lowestCPA)) {
          lowestCPA = cpa;
          lowestCPAChannel = ch;
        }
      }
    }
    if (lowestCPA !== null) {
      bestChannel = lowestCPAChannel;
    }
  }

  // Step 5: Call Groq for ICP discovery
  let icpOutput: ICPDiscoveryOutput;
  try {
    icpOutput = await discoverICPWithGroq(sprint, gtmIntent, bestAngle, bestHeadline, bestChannel);
  } catch (err) {
    console.error(`[icp-discovery] Groq discovery failed for ${sprintId}:`, err);
    // Write failure event
    await db.from('sprint_events').insert({
      sprint_id: sprintId,
      agent: 'icp-discovery',
      event_type: 'icp_discovery_failed',
      payload: { error: String(err) },
    });
    return;
  }

  // Step 6: PATCH the sprint row
  await db
    .from('sprints')
    .update({ icp_discovery: icpOutput, updated_at: new Date().toISOString() })
    .eq('id', sprintId);

  // Step 7: Write sprint event
  await db.from('sprint_events').insert({
    sprint_id: sprintId,
    agent: 'icp-discovery',
    event_type: 'icp_discovery_complete',
    payload: { segment_count: icpOutput.segments.length },
  });

  console.log(`[icp-discovery] Completed for ${sprintId}: ${icpOutput.segments.length} segments identified`);
}

// ── Helper: Extract GTM intent ─────────────────────────────────────────────

async function extractGTMIntent(idea: string): Promise<GTMIntent> {
  const system = 'Extract GTM targeting signals from this startup idea. Return ONLY valid JSON, no preamble, no markdown.';
  const user = idea;

  const schema = {
    explicit_target_mentioned: 'boolean',
    target_stage: 'string or null',
    target_role: 'string or null',
    target_industry: 'string or null',
    company_size: 'string or null',
  };

  const response = await callGroqJSON<GTMIntent>(
    [
      { role: 'system', content: system + '\n\nSchema: ' + JSON.stringify(schema) },
      { role: 'user', content: user },
    ],
    { model: 'llama-3.3-70b-versatile', max_tokens: 200, temperature: 0.2 }
  );

  return response;
}

// ── Helper: Discover ICP with Groq ───────────────────────────────────────────

async function discoverICPWithGroq(
  sprint: any,
  gtmIntent: GTMIntent,
  bestAngle: string,
  bestHeadline: string,
  bestChannel: string
): Promise<ICPDiscoveryOutput> {
  const system = 'You are a GTM strategist. Analyze real ad performance data to identify the 3 most specific customer segments. Return ONLY valid JSON. No preamble. No markdown code blocks.';

  const vertical = sprint.genome?.market_category || 'unknown';
  const icp = sprint.genome?.icp || 'not specified';
  const ctr = sprint.campaign?.meta?.angle_metrics?.[0]?.ctr || 'no data';
  const marketSignal = sprint.verdict?.demand_validation?.market_signal_strength || 'unknown';

  let userPrompt = `Startup idea: ${sprint.idea}
Initial ICP hypothesis: ${icp}
Vertical: ${vertical}
Best performing angle: ${bestAngle}
Best performing headline: ${bestHeadline}
Best channel: ${bestChannel}
Campaign CTR: ${ctr} vs vertical benchmark
Market signal: ${marketSignal}`;

  if (gtmIntent.explicit_target_mentioned) {
    const parts = [
      gtmIntent.target_stage,
      gtmIntent.target_role,
      gtmIntent.target_industry,
    ].filter(Boolean);
    if (parts.length > 0) {
      userPrompt += `\nFounder explicitly targets: ${parts.join(' ')}`;
    }
  }

  userPrompt += `

Return JSON with this exact schema:
{
  "segments": [
    {
      "segment_name": "specific segment name",
      "why_they_fit": "one paragraph grounded in campaign evidence",
      "where_to_find_them": "specific channels, communities, platforms",
      "estimated_segment_size": "rough estimate",
      "outreach_angle": "specific message that would resonate",
      "urgency_signal": "what triggers this person to act now"
    }
  ]
}`;

  const content = await callGroq(
    [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ],
    { model: 'llama-3.3-70b-versatile', max_tokens: 1000, temperature: 0.3 }
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
    return JSON.parse(jsonStr) as ICPDiscoveryOutput;
  } catch (err) {
    throw new Error(`Failed to parse Groq response as JSON: ${jsonStr.slice(0, 200)}`);
  }
}
