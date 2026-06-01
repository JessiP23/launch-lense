// ─────────────────────────────────────────────────────────────────────────────
// ICP Discovery Engine — Behavioral customer segment identification
// Analyzes campaign performance + genome data + market signals to identify the 3 most
// likely customer segments based on who actually clicked, not who the founder guessed.
// ─────────────────────────────────────────────────────────────────────────────

import { callGroqJSON } from '@/lib/groq';
import { createServiceClient } from '@/lib/supabase';
import type { GenomeAgentOutput, VerdictAgentOutput, AngleAgentOutput, CampaignAgentOutput } from './types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ICPSegment {
  segment_name: string;
  why_they_fit: string;
  where_to_find_them: string;
  estimated_segment_size: string;
  outreach_angle: string;
  urgency_signal: string;
}

export interface ICPDiscoveryResult {
  sprint_id: string;
  segments: ICPSegment[];
  generated_at: string;
}

interface GTMIntent {
  explicit_target_mentioned: boolean;
  target_stage: 'seed' | 'series_a' | 'series_b' | 'enterprise' | null;
  target_role: 'founder' | 'cto' | 'vp_marketing' | 'growth' | null;
  target_industry: string | null;
  company_size: '1-10' | '11-50' | '51-200' | '201+' | null;
}

// ── GTM Intent Enrichment Map ───────────────────────────────────────────────

const ICP_ENRICHMENT: Record<string, string[]> = {
  'series_a': [
    'Crunchbase recently funded companies list (filter: Series A, last 90 days)',
    'LinkedIn Sales Navigator: Company headcount 11-50, Funding round: Series A',
    'AngelList / Wellfound company database',
    'YC company directory (for YC-backed Series A)',
    'Twitter/X: filter by "raised Series A" mentions in last 30 days',
    'ProductHunt: recently launched products with funded badge',
  ],
  'seed': [
    'Crunchbase seed rounds last 60 days',
    'Twitter/X: founders announcing seed rounds',
    'Indie Hackers community (pre-Series A)',
    'YC Startup School community',
  ],
  'series_b': [
    'Crunchbase Series B rounds last 90 days',
    'LinkedIn Sales Navigator: Company headcount 51-200, Funding: Series B',
    'TechCrunch coverage of Series B announcements',
  ],
  'enterprise': [
    'LinkedIn Sales Navigator: Company headcount 1000+',
    'G2 and Capterra enterprise software reviewers',
    'Enterprise tech conferences and summits',
  ],
  'founder': [
    'Twitter/X founder communities',
    'Indie Hackers',
    'ProductHunt makers',
    'YC Startup School',
    'FounderDating',
  ],
  'cto': [
    'LinkedIn: CTO, VP Engineering, 11-200 employees',
    'GitHub organizations and repositories',
    'Stack Overflow developer communities',
    'CTO-focused Slack communities',
  ],
  'vp_marketing': [
    'LinkedIn: VP Marketing, 11-200 employees, B2B SaaS',
    'CMO Alliance community',
    'Exit Five (Dave Gerhardt) B2B marketing community',
    'Marketing technology conferences',
  ],
  'growth': [
    'LinkedIn: Growth Marketing Manager, Head of Growth',
    'GrowthHackers community',
    'Reforge alumni network',
    'Product marketing Slack communities',
  ],
};

// ── GTM Intent Parser ────────────────────────────────────────────────────────

async function parseGTMIntent(idea: string): Promise<GTMIntent> {
  const system = `Extract any explicit GTM targeting signals from this startup idea description. Return JSON only.`;
  const user = idea;

  try {
    const result = await callGroqJSON<GTMIntent>(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { temperature: 0.1, max_tokens: 300 }
    );
    return result;
  } catch (err) {
    console.warn('[ICP Discovery] GTM intent parsing failed, using defaults:', err);
    return {
      explicit_target_mentioned: false,
      target_stage: null,
      target_role: null,
      target_industry: null,
      company_size: null,
    };
  }
}

// ── Main ICP Discovery Function ───────────────────────────────────────────

export async function runICPDiscovery(sprintId: string): Promise<ICPDiscoveryResult> {
  const db = createServiceClient();

  // Fetch sprint data
  const { data: sprint, error: sprintError } = await db
    .from('sprints')
    .select('idea, genome, verdict, angles, campaign')
    .eq('id', sprintId)
    .single();

  if (sprintError || !sprint) {
    throw new Error(`Sprint ${sprintId} not found`);
  }

  const genome = sprint.genome as GenomeAgentOutput | null;
  const verdict = sprint.verdict as VerdictAgentOutput | null;
  const angles = sprint.angles as AngleAgentOutput | null;
  const campaign = sprint.campaign as Record<string, CampaignAgentOutput> | null;

  if (!genome || !verdict || !angles || !campaign) {
    throw new Error(`Sprint ${sprintId} missing required data for ICP discovery`);
  }

  // STEP 0: Parse GTM intent from idea
  const gtmIntent = await parseGTMIntent(sprint.idea);

  // STEP 1: Extract behavioral signals
  const campaignEntries = Object.entries(campaign) as [string, CampaignAgentOutput][];
  const completedCampaigns = campaignEntries.filter(([, c]) => c.status === 'COMPLETE');

  // Find best performing angle
  let bestAngle = null;
  let bestAngleCTR = 0;
  for (const [, camp] of completedCampaigns) {
    for (const metric of camp.angle_metrics) {
      if (metric.ctr > bestAngleCTR && metric.status !== 'PAUSED') {
        bestAngleCTR = metric.ctr;
        bestAngle = metric.id;
      }
    }
  }

  // Find best channel (lowest CPA among non-NO-GO channels)
  const bestChannelEntry = verdict.per_channel
    .filter((c) => c.verdict !== 'NO-GO')
    .sort((a, b) => {
      const cpaA = a.total_spend_cents > 0 && a.clicks > 0 ? a.total_spend_cents / a.clicks : Infinity;
      const cpaB = b.total_spend_cents > 0 && b.clicks > 0 ? b.total_spend_cents / b.clicks : Infinity;
      return cpaA - cpaB;
    })[0];

  const bestChannel = bestChannelEntry?.channel ?? 'meta';
  const bestCPA = bestChannelEntry?.total_spend_cents && bestChannelEntry?.clicks > 0
    ? (bestChannelEntry.total_spend_cents / bestChannelEntry.clicks / 100).toFixed(2)
    : 'N/A';

  // Get best angle details
  const bestAngleData = angles.angles.find((a) => a.id === bestAngle);
  const bestArchetype = bestAngleData?.archetype ?? 'PAIN';
  const bestHeadline = bestAngleData?.copy.meta?.headline ?? 'N/A';

  // STEP 2: Cross-reference with market signals using Groq
  let userPrompt = `Sprint idea: ${sprint.idea}
Initial ICP hypothesis: ${genome.icp}
Vertical: ${genome.market_category}
Best performing angle archetype: ${bestArchetype}
Best performing angle headline: ${bestHeadline}
Campaign CTR: ${(verdict.aggregate_metrics.weighted_blended_ctr * 100).toFixed(2)}%
Best channel: ${bestChannel} at $${bestCPA} CPA
Market signal strength: ${verdict.demand_validation?.scores.market_signal_strength ?? 'MODERATE'}

Based on this behavioral evidence, identify the 3 most specific customer segments who are most likely to buy this product. For each segment, provide:
1. segment_name: specific, not generic (e.g. "Series A B2B SaaS founders who just hired their first sales rep" not "startup founders")
2. why_they_fit: one paragraph grounded in the campaign evidence
3. where_to_find_them: specific channels, communities, events, platforms — not generic advice
4. estimated_segment_size: rough TAM for this specific segment
5. outreach_angle: the specific message that would resonate, based on what performed in the campaign
6. urgency_signal: what triggers this person to buy NOW (job change, funding event, competitor move, etc.)

Respond ONLY in JSON. No preamble. Schema: { segments: [{ segment_name, why_they_fit, where_to_find_them, estimated_segment_size, outreach_angle, urgency_signal }] }`;

  // Add GTM intent context if explicitly mentioned
  if (gtmIntent.explicit_target_mentioned) {
    userPrompt += `

IMPORTANT: The founder explicitly wants to reach ${gtmIntent.target_stage} ${gtmIntent.target_role}s in ${gtmIntent.target_industry}. Weight your segment recommendations toward this profile, but include at least one segment the campaign data suggests could be an unexpected adjacent buyer.`;
  }

  const systemPrompt = `You are a GTM strategist with deep expertise in startup customer discovery. You analyze real advertising performance data to identify who the actual buyer is, not who the founder assumed it would be.`;

  let groqResponse: { segments: ICPSegment[] };
  try {
    groqResponse = await callGroqJSON<{ segments: ICPSegment[] }>(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { temperature: 0.3, max_tokens: 1500 }
    );
  } catch (err) {
    console.error('[ICP Discovery] Groq call failed:', err);
    throw new Error('ICP Discovery failed to generate segments');
  }

  // STEP 3: Enrich with GTM-specific sources
  const enrichedSegments = groqResponse.segments.map((segment) => {
    const enrichedWhere = [...segment.where_to_find_them];

    // Add enrichment based on parsed GTM intent
    if (gtmIntent.target_stage && ICP_ENRICHMENT[gtmIntent.target_stage]) {
      ICP_ENRICHMENT[gtmIntent.target_stage].forEach((source) => {
        if (!enrichedWhere.includes(source)) {
          enrichedWhere.push(source);
        }
      });
    }

    if (gtmIntent.target_role && ICP_ENRICHMENT[gtmIntent.target_role]) {
      ICP_ENRICHMENT[gtmIntent.target_role].forEach((source) => {
        if (!enrichedWhere.includes(source)) {
          enrichedWhere.push(source);
        }
      });
    }

    return {
      ...segment,
      where_to_find_them: enrichedWhere.join('\n'),
    };
  });

  // STEP 4: Persist ICP discovery results
  const result: ICPDiscoveryResult = {
    sprint_id: sprintId,
    segments: enrichedSegments,
    generated_at: new Date().toISOString(),
  };

  await db
    .from('sprints')
    .update({ icp_discovery: result as unknown as Record<string, unknown> })
    .eq('id', sprintId);

  // Write sprint event
  await db.from('sprint_events').insert({
    sprint_id: sprintId,
    agent: 'icp_discovery',
    event_type: 'icp_discovery_complete',
    payload: { segment_count: 3 },
  });

  return result;
}
