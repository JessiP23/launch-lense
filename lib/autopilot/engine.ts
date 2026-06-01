// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — Autopilot Engine
//
// Manages campaign spend, pauses underperforming channels, and rotates creatives
// automatically based on performance metrics. Runs on a 15-minute cron cycle.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase';
import { getSprint, transitionState } from '@/lib/sprint-machine';
import type { Platform } from '@/lib/agents/types';

// ── Types ─────────────────────────────────────────────────────────────────

export interface AutopilotConfig {
  id: string;
  sprint_id: string;
  enabled: boolean;
  daily_budget_cents: number;
  total_budget_cents: number;
  target_cpa_cents: number | null;
  target_ctr_floor: number | null;
  channels: string[];
  auto_pause_on_underperform: boolean;
  auto_scale_on_overperform: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutopilotDecision {
  id: string;
  sprint_id: string;
  channel: string;
  decision_type: string;
  trigger: string;
  metrics_at_decision: Record<string, unknown>;
  action_taken: Record<string, unknown>;
  outcome_after_1h: Record<string, unknown> | null;
  reasoning: string;
  created_at: string;
}

// ── Main cycle runner ───────────────────────────────────────────────────────

export async function runAutopilotCycle(): Promise<void> {
  const db = createServiceClient();

  // Query all enabled autopilot configs
  const { data: configs, error } = await db
    .from('autopilot_configs')
    .select('*')
    .eq('enabled', true);

  if (error) {
    console.error('[autopilot] Failed to fetch configs:', error.message);
    return;
  }

  if (!configs || configs.length === 0) {
    console.log('[autopilot] No enabled configs found');
    return;
  }

  console.log(`[autopilot] Running cycle for ${configs.length} enabled configs`);

  // Process each config
  for (const config of configs as AutopilotConfig[]) {
    try {
      const sprint = await getSprint(config.sprint_id);
      if (!sprint) {
        console.warn(`[autopilot] Sprint ${config.sprint_id} not found, skipping`);
        continue;
      }

      // Only process if sprint is in running states
      if (sprint.state !== 'CAMPAIGN_RUNNING' && sprint.state !== 'CAMPAIGN_MONITORING') {
        continue;
      }

      // Evaluate each channel
      for (const channel of config.channels) {
        await evaluateAndDecide(config.sprint_id, channel, config).catch(err => {
          console.error(`[autopilot] evaluateAndDecide failed for ${config.sprint_id}/${channel}:`, err);
        });
      }
    } catch (err) {
      console.error(`[autopilot] Failed to process config ${config.id}:`, err);
    }
  }
}

// ── Evaluate and decide ─────────────────────────────────────────────────────

async function evaluateAndDecide(
  sprintId: string,
  channel: string,
  config: AutopilotConfig
): Promise<void> {
  const db = createServiceClient();

  // Step 1: Sync spend
  await syncSpendForChannel(sprintId, channel);

  // Step 2: Read today's budget log
  const today = new Date().toISOString().split('T')[0];
  const { data: budgetLog } = await db
    .from('autopilot_budget_log')
    .select('*')
    .eq('sprint_id', sprintId)
    .eq('channel', channel)
    .eq('date', today)
    .maybeSingle();

  // Step 3: Read sprint.campaign
  const sprint = await getSprint(sprintId);
  if (!sprint?.campaign) {
    console.warn(`[autopilot] No campaign data for ${sprintId}`);
    return;
  }

  const channelData = (sprint.campaign as Record<string, any>)[channel];
  if (!channelData) {
    console.warn(`[autopilot] No channel data for ${sprintId}/${channel}`);
    return;
  }

  // Step 4: Extract metrics
  const ctr = channelData.angle_metrics?.[0]?.ctr || 0;
  const cpc = channelData.angle_metrics?.[0]?.cpc_cents || 0;
  const cpa = channelData.angle_metrics?.[0]?.spend_cents 
    ? channelData.angle_metrics[0].spend_cents / (channelData.angle_metrics[0].clicks || 1)
    : null;
  const spendToday = budgetLog?.spend_cents || 0;

  const metrics = { ctr, cpc, cpa, spend_today: spendToday };

  // Step 5: BUDGET GUARD
  if (spendToday >= config.daily_budget_cents) {
    await writeDecision(sprintId, channel, 'pause', 'budget_hit', metrics, 'Daily budget cap reached');
    return;
  }

  // Step 6: TOTAL GUARD
  const { data: totalSpendResult } = await db
    .from('autopilot_budget_log')
    .select('spend_cents')
    .eq('sprint_id', sprintId);

  const totalSpend = totalSpendResult?.reduce((sum, row) => sum + (row.spend_cents || 0), 0) || 0;
  if (totalSpend >= config.total_budget_cents) {
    await stopAutopilot(sprintId, 'budget_hit');
    return;
  }

  // Step 7: PERFORMANCE CHECKS
  if (config.auto_pause_on_underperform) {
    if (config.target_ctr_floor && ctr < config.target_ctr_floor) {
      await writeDecision(
        sprintId,
        channel,
        'pause',
        'ctr_drop',
        metrics,
        `CTR ${ctr} below floor ${config.target_ctr_floor}`
      );
      return;
    }

    if (config.target_cpa_cents && cpa && cpa > config.target_cpa_cents) {
      await writeDecision(
        sprintId,
        channel,
        'pause',
        'cpa_exceeded',
        metrics,
        `CPA exceeded target`
      );
      return;
    }
  }

  // Step 8: OVERPERFORM CHECK
  if (config.auto_scale_on_overperform) {
    if (config.target_ctr_floor && ctr > config.target_ctr_floor * 1.2) {
      if (config.target_cpa_cents && cpa && cpa < config.target_cpa_cents * 0.8) {
        await writeDecision(
          sprintId,
          channel,
          'scale_up',
          'overperform',
          metrics,
          `Beating targets by 20%+`
        );
        return;
      }
    }
  }

  // Step 9: CREATIVE FATIGUE
  const { data: fatiguedCreatives } = await db
    .from('autopilot_creative_pool')
    .select('*')
    .eq('sprint_id', sprintId)
    .eq('channel', channel)
    .eq('is_active', true)
    .or('fatigue_score.gt.70,impressions_served.gt.10000');

  if (fatiguedCreatives && fatiguedCreatives.length > 0) {
    await rotateCreative(sprintId, channel);
  }
}

// ── Write decision ─────────────────────────────────────────────────────────

async function writeDecision(
  sprintId: string,
  channel: string,
  type: string,
  trigger: string,
  metrics: Record<string, unknown>,
  reasoning: string
): Promise<void> {
  const db = createServiceClient();

  await db.from('autopilot_decisions').insert({
    sprint_id: sprintId,
    channel,
    decision_type: type,
    trigger,
    metrics_at_decision: metrics,
    action_taken: { type, channel },
    reasoning,
    created_at: new Date().toISOString(),
  });

  await db.from('sprint_events').insert({
    sprint_id: sprintId,
    agent: 'autopilot',
    event_type: 'autopilot_decision',
    payload: { decision_type: type, channel, trigger, reasoning },
  });

  console.log(`[autopilot] Decision written: ${type} for ${sprintId}/${channel} - ${reasoning}`);
}

// ── Rotate creative ─────────────────────────────────────────────────────────

async function rotateCreative(sprintId: string, channel: string): Promise<void> {
  const db = createServiceClient();

  // Find creative with lowest fatigue score that hasn't been served recently
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  const { data: candidate } = await db
    .from('autopilot_creative_pool')
    .select('*')
    .eq('sprint_id', sprintId)
    .eq('channel', channel)
    .eq('is_active', true)
    .or(`last_served_at.is.null,last_served_at.lt.${twoHoursAgo}`)
    .order('fatigue_score', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!candidate) {
    console.warn(`[autopilot] No eligible creative to rotate for ${sprintId}/${channel}`);
    return;
  }

  // Update the selected creative
  await db
    .from('autopilot_creative_pool')
    .update({
      last_served_at: new Date().toISOString(),
      impressions_served: (candidate.impressions_served || 0) + 1,
      fatigue_score: (candidate.fatigue_score || 0) + 5,
    })
    .eq('id', candidate.id);

  // Increase fatigue for previously served creatives
  const { data: oldCreatives } = await db
    .from('autopilot_creative_pool')
    .select('id, fatigue_score')
    .eq('sprint_id', sprintId)
    .eq('channel', channel)
    .eq('is_active', true)
    .lt('last_served_at', twoHoursAgo)
    .neq('id', candidate.id);

  if (oldCreatives) {
    for (const old of oldCreatives) {
      await db
        .from('autopilot_creative_pool')
        .update({ fatigue_score: (old.fatigue_score || 0) + 25 })
        .eq('id', old.id);
    }
  }

  await writeDecision(
    sprintId,
    channel,
    'creative_rotate',
    'creative_fatigue',
    {},
    `Rotated to creative ${candidate.creative_id}`
  );
}

// ── Stop autopilot ─────────────────────────────────────────────────────────

export async function stopAutopilot(sprintId: string, trigger: string): Promise<void> {
  const db = createServiceClient();

  await db
    .from('autopilot_configs')
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq('sprint_id', sprintId);

  await writeDecision(sprintId, 'all', 'stop', trigger, {}, 'Total budget reached. Autopilot stopped. Verdict generating.');

  // Transition to VERDICT_GENERATING
  await transitionState(sprintId, 'VERDICT_GENERATING');

  await db.from('sprint_events').insert({
    sprint_id: sprintId,
    agent: 'autopilot',
    event_type: 'autopilot_stopped',
    payload: { trigger },
  });

  console.log(`[autopilot] Stopped for ${sprintId} due to ${trigger}`);
}

// ── Sync spend for channel ─────────────────────────────────────────────────

async function syncSpendForChannel(sprintId: string, channel: string): Promise<void> {
  const db = createServiceClient();

  const sprint = await getSprint(sprintId);
  if (!sprint?.campaign) return;

  const channelData = (sprint.campaign as Record<string, any>)[channel];
  if (!channelData) return;

  const today = new Date().toISOString().split('T')[0];
  const totalSpend = channelData.angle_metrics?.reduce((sum: number, m: any) => sum + (m.spend_cents || 0), 0) || 0;
  const totalImpressions = channelData.angle_metrics?.reduce((sum: number, m: any) => sum + (m.impressions || 0), 0) || 0;
  const totalClicks = channelData.angle_metrics?.reduce((sum: number, m: any) => sum + (m.clicks || 0), 0) || 0;
  const conversions = 0; // TODO: Extract from conversion data

  await db.from('autopilot_budget_log').upsert(
    {
      sprint_id: sprintId,
      channel,
      date: today,
      spend_cents: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions,
    },
    { onConflict: 'sprint_id,channel,date' }
  );
}

// ── Init autopilot pool ─────────────────────────────────────────────────────

export async function initAutopilotPool(sprintId: string): Promise<void> {
  const db = createServiceClient();

  // Read sprint_creatives for approved creatives
  const { data: creatives, error } = await db
    .from('sprint_creatives')
    .select('*')
    .eq('sprint_id', sprintId)
    .eq('status', 'approved');

  if (error) {
    console.error(`[autopilot] Failed to fetch creatives for ${sprintId}:`, error.message);
    return;
  }

  if (!creatives || creatives.length === 0) {
    console.log(`[autopilot] No approved creatives for ${sprintId}`);
    return;
  }

  // Insert into autopilot_creative_pool
  for (const creative of creatives) {
    const { error: insertError } = await db.from('autopilot_creative_pool').insert({
      sprint_id: sprintId,
      creative_id: creative.id,
      channel: creative.platform,
      fatigue_score: 0,
      is_active: true,
    });
    // Ignore if already exists (unique constraint on sprint_id + creative_id + channel)
    if (insertError && insertError.code !== '23505') {
      console.error(`[autopilot] Failed to insert creative ${creative.id}:`, insertError.message);
    }
  }

  await db.from('sprint_events').insert({
    sprint_id: sprintId,
    agent: 'autopilot',
    event_type: 'autopilot_pool_initialized',
    payload: { creative_count: creatives.length },
  });

  console.log(`[autopilot] Pool initialized for ${sprintId} with ${creatives.length} creatives`);
}
