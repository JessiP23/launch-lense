// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — Signal Fabric
//
// The Signal Fabric is the cross-sprint learning layer that makes every new
// sprint smarter than the last. It aggregates performance data from completed
// sprints into benchmarks that calibrate GenomeAgent pre-screens and VerdictAgent
// verdicts against real market behavior instead of static thresholds.
//
// Functions:
//   - writeSprintSignal(sprintId): Records sprint performance after COMPLETE
//   - updateBenchmarks(vertical, channel): Recalculates aggregated benchmarks
//   - getVerticalBenchmarks(vertical): Fetches benchmarks for Genome/Verdict
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase';
import { getSprint } from '@/lib/sprint-machine';
import type { Platform, SprintRecord } from '@/lib/agents/types';

// ── Types ─────────────────────────────────────────────────────────────────

export interface BenchmarkRow {
  vertical: string;
  channel: Platform;
  avg_ctr: number | null;
  avg_cpc: number | null;
  avg_cvr: number | null;
  avg_cpa: number | null;
  sample_size: number;
  last_updated: string;
}

export interface SprintSignalRow {
  sprint_id: string;
  vertical: string;
  channel: Platform;
  ctr: number | null;
  cpc: number | null;
  cvr: number | null;
  cpa: number | null;
  verdict: 'GO' | 'ITERATE' | 'NO-GO' | null;
  angle_archetype: string | null;
  created_at: string;
}

export interface SignalPatternRow {
  vertical: string;
  channel: Platform;
  angle_archetype: 'PAIN' | 'ASPIRATION' | 'SOCIAL_PROOF' | 'CURIOSITY' | 'AUTHORITY';
  avg_ctr_lift: number | null;
  sample_size: number;
  last_updated: string;
}

// ── writeSprintSignal ───────────────────────────────────────────────────────
// Records sprint performance to sprint_signals table after sprint reaches COMPLETE.
// Called by orchestrator during VERDICT_GENERATING → COMPLETE transition.

export async function writeSprintSignal(sprintId: string): Promise<void> {
  const db = createServiceClient();
  const sprint = await getSprint(sprintId);

  if (!sprint) {
    console.error(`[signal-fabric] Sprint ${sprintId} not found`);
    return;
  }

  if (!sprint.verdict) {
    console.warn(`[signal-fabric] Sprint ${sprintId} has no verdict, skipping signal write`);
    return;
  }

  if (!sprint.campaign) {
    console.warn(`[signal-fabric] Sprint ${sprintId} has no campaign data, skipping signal write`);
    return;
  }

  // Extract vertical from genome or default to 'other'
  const vertical = sprint.genome?.market_category?.toLowerCase() || 'other';

  // Write one row per active channel
  for (const channel of sprint.active_channels) {
    const campaignData = sprint.campaign[channel];
    if (!campaignData) continue;

    // Calculate blended metrics from angle_metrics
    const totalImpressions = campaignData.angle_metrics.reduce((sum, m) => sum + m.impressions, 0);
    const totalClicks = campaignData.angle_metrics.reduce((sum, m) => sum + m.clicks, 0);
    const totalSpend = campaignData.angle_metrics.reduce((sum, m) => sum + m.spend_cents, 0);

    const ctr = totalImpressions > 0 ? totalClicks / totalImpressions : null;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : null;
    
    // CVR requires landing page data — may not always be available
    const cvr = null; // TODO: Extract from sprint.verdict.demand_validation or landing_conversion_rate
    const cpa = null; // TODO: Calculate from conversion data

    // Get the winning angle archetype
    const winningAngleId = sprint.verdict.cross_channel_winning_angle || campaignData.angle_metrics[0]?.id;
    const winningAngle = sprint.angles?.angles.find((a) => a.id === winningAngleId);
    const angleArchetype = winningAngle?.archetype || null;

    const signalRow: Partial<SprintSignalRow> = {
      sprint_id: sprintId,
      vertical,
      channel,
      ctr: ctr !== null && ctr !== undefined ? Number(ctr.toFixed(4)) : null,
      cpc: cpc !== null && cpc !== undefined ? Number(cpc.toFixed(2)) : null,
      cvr,
      cpa,
      verdict: sprint.verdict.verdict || null,
      angle_archetype: angleArchetype,
    };

    const { error } = await db.from('sprint_signals').insert(signalRow);
    if (error) {
      console.error(`[signal-fabric] Failed to write sprint signal for ${sprintId}/${channel}:`, error.message);
    } else {
      console.log(`[signal-fabric] Wrote sprint signal for ${sprintId}/${channel}: CTR=${ctr}, CPC=${cpc}, Verdict=${sprint.verdict.verdict}`);
    }
  }

  // After writing signals, update benchmarks for all affected vertical+channel combos
  for (const channel of sprint.active_channels) {
    await updateBenchmarks(vertical, channel);
  }
}

// ── updateBenchmarks ───────────────────────────────────────────────────────
// Recalculates aggregated benchmarks for a vertical+channel combination from all
// sprint_signals rows. Upserts into signal_benchmarks table.

export async function updateBenchmarks(vertical: string, channel: Platform): Promise<void> {
  const db = createServiceClient();

  // Fetch all sprint_signals for this vertical+channel
  const { data: signals, error: fetchError } = await db
    .from('sprint_signals')
    .select('ctr, cpc, cvr, cpa')
    .eq('vertical', vertical)
    .eq('channel', channel);

  if (fetchError) {
    console.error(`[signal-fabric] Failed to fetch signals for ${vertical}/${channel}:`, fetchError.message);
    return;
  }

  if (!signals || signals.length === 0) {
    console.log(`[signal-fabric] No signals found for ${vertical}/${channel}, skipping benchmark update`);
    return;
  }

  // Calculate averages (excluding null values)
  const ctrValues = signals.map((s) => s.ctr).filter((v): v is number => v !== null);
  const cpcValues = signals.map((s) => s.cpc).filter((v): v is number => v !== null);
  const cvrValues = signals.map((s) => s.cvr).filter((v): v is number => v !== null);
  const cpaValues = signals.map((s) => s.cpa).filter((v): v is number => v !== null);

  const avgCtr = ctrValues.length > 0
    ? ctrValues.reduce((sum, v) => sum + v, 0) / ctrValues.length
    : null;
  const avgCpc = cpcValues.length > 0
    ? cpcValues.reduce((sum, v) => sum + v, 0) / cpcValues.length
    : null;
  const avgCvr = cvrValues.length > 0
    ? cvrValues.reduce((sum, v) => sum + v, 0) / cvrValues.length
    : null;
  const avgCpa = cpaValues.length > 0
    ? cpaValues.reduce((sum, v) => sum + v, 0) / cpaValues.length
    : null;

  // Upsert into signal_benchmarks
  const benchmarkRow = {
    vertical,
    channel,
    avg_ctr: avgCtr !== null ? Number(avgCtr.toFixed(4)) : null,
    avg_cpc: avgCpc !== null ? Number(avgCpc.toFixed(2)) : null,
    avg_cvr: avgCvr !== null ? Number(avgCvr.toFixed(4)) : null,
    avg_cpa: avgCpa !== null ? Number(avgCpa.toFixed(2)) : null,
    sample_size: signals.length,
    last_updated: new Date().toISOString(),
  };

  const { error: upsertError } = await db
    .from('signal_benchmarks')
    .upsert(benchmarkRow, { onConflict: 'vertical,channel' });

  if (upsertError) {
    console.error(`[signal-fabric] Failed to upsert benchmark for ${vertical}/${channel}:`, upsertError.message);
  } else {
    console.log(`[signal-fabric] Updated benchmark for ${vertical}/${channel}: n=${signals.length}, CTR=${avgCtr}, CPC=${avgCpc}`);
  }
}

// ── getVerticalBenchmarks ───────────────────────────────────────────────────
// Fetches all benchmarks for a given vertical. Used by GenomeAgent and VerdictAgent
// to calibrate predictions against real historical performance.

export async function getVerticalBenchmarks(vertical: string): Promise<BenchmarkRow[]> {
  const db = createServiceClient();

  const { data, error } = await db
    .from('signal_benchmarks')
    .select('*')
    .eq('vertical', vertical);

  if (error) {
    console.error(`[signal-fabric] Failed to fetch benchmarks for ${vertical}:`, error.message);
    return [];
  }

  return (data || []).map((row) => ({
    vertical: row.vertical,
    channel: row.channel as Platform,
    avg_ctr: row.avg_ctr !== null ? Number(row.avg_ctr) : null,
    avg_cpc: row.avg_cpc !== null ? Number(row.avg_cpc) : null,
    avg_cvr: row.avg_cvr !== null ? Number(row.avg_cvr) : null,
    avg_cpa: row.avg_cpa !== null ? Number(row.avg_cpa) : null,
    sample_size: row.sample_size,
    last_updated: row.last_updated,
  }));
}

// ── getAllBenchmarks ───────────────────────────────────────────────────────
// Fetches all benchmarks across all verticals. Used for intelligence dashboard.

export async function getAllBenchmarks(): Promise<BenchmarkRow[]> {
  const db = createServiceClient();

  const { data, error } = await db
    .from('signal_benchmarks')
    .select('*')
    .order('vertical', { ascending: true })
    .order('channel', { ascending: true });

  if (error) {
    console.error('[signal-fabric] Failed to fetch all benchmarks:', error.message);
    return [];
  }

  return (data || []).map((row) => ({
    vertical: row.vertical,
    channel: row.channel as Platform,
    avg_ctr: row.avg_ctr !== null ? Number(row.avg_ctr) : null,
    avg_cpc: row.avg_cpc !== null ? Number(row.avg_cpc) : null,
    avg_cvr: row.avg_cvr !== null ? Number(row.avg_cvr) : null,
    avg_cpa: row.avg_cpa !== null ? Number(row.avg_cpa) : null,
    sample_size: row.sample_size,
    last_updated: row.last_updated,
  }));
}

// ── getRecentSprintSignals ───────────────────────────────────────────────────
// Fetches the most recent sprint signals for the live feed. Used by intelligence
// dashboard to show real-time validation activity.

export async function getRecentSprintSignals(limit: number = 20): Promise<SprintSignalRow[]> {
  const db = createServiceClient();

  const { data, error } = await db
    .from('sprint_signals')
    .select(`
      sprint_id,
      vertical,
      channel,
      ctr,
      cpc,
      cvr,
      cpa,
      verdict,
      angle_archetype,
      created_at,
      sprints (idea)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[signal-fabric] Failed to fetch recent sprint signals:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    sprint_id: row.sprint_id,
    vertical: row.vertical,
    channel: row.channel,
    ctr: row.ctr !== null ? Number(row.ctr) : null,
    cpc: row.cpc !== null ? Number(row.cpc) : null,
    cvr: row.cvr !== null ? Number(row.cvr) : null,
    cpa: row.cpa !== null ? Number(row.cpa) : null,
    verdict: row.verdict,
    angle_archetype: row.angle_archetype,
    created_at: row.created_at,
  }));
}
