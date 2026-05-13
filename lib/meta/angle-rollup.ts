// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — sprint_angle_results rollup builder
//
// Aggregates the latest sprint_metrics snapshot + sprint_lp_events into a
// per-(sprint, angle, channel) denormalized row that the VerdictAgent and
// canvas/report views can read in O(1) without scanning event tables.
//
// Idempotent: always upserts on the (sprint_id, angle_id, channel) key.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase';

export interface AngleRollupRow {
  sprint_id: string;
  angle_id: string;
  channel: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc_cents: number;
  spend_cents: number;
  lp_views: number;
  lp_cta_clicks: number;
  lp_form_submits: number;
  lp_email_captures: number;
  scroll_50_pct: number;
  scroll_75_pct: number;
  scroll_100_pct: number;
  meta_leads: number;
}

interface LpEventCounts {
  page_view: number;
  cta_click: number;
  form_submit: number;
  email_capture: number;
  scroll_50: number;
  scroll_75: number;
  scroll_100: number;
}

const EMPTY_LP_COUNTS: LpEventCounts = {
  page_view: 0,
  cta_click: 0,
  form_submit: 0,
  email_capture: 0,
  scroll_50: 0,
  scroll_75: 0,
  scroll_100: 0,
};

/** Aggregate LP events for a sprint, grouped by angle_id. */
export async function aggregateLpEventsByAngle(
  sprintId: string
): Promise<Map<string, LpEventCounts>> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('sprint_lp_events')
    .select('angle_id, event_name, metadata')
    .eq('sprint_id', sprintId)
    .limit(10_000);

  const out = new Map<string, LpEventCounts>();
  if (error || !data) return out;

  for (const row of data) {
    const angle = (row.angle_id as string | null) ?? 'unknown';
    const current = out.get(angle) ?? { ...EMPTY_LP_COUNTS };
    const ev = row.event_name as string;
    if (ev === 'page_view') current.page_view++;
    else if (ev === 'cta_click') current.cta_click++;
    else if (ev === 'form_submit') current.form_submit++;
    else if (ev === 'email_capture') current.email_capture++;
    else if (ev === 'scroll_depth') {
      const depth = Number(
        (row.metadata as Record<string, unknown> | null)?.['depth_pct'] ?? 0
      );
      if (depth >= 100) current.scroll_100++;
      else if (depth >= 75) current.scroll_75++;
      else if (depth >= 50) current.scroll_50++;
    }
    out.set(angle, current);
  }
  return out;
}

/** LP conversions (form submits + email captures) for a given angle. */
export function lpConversionsFor(counts: LpEventCounts | undefined): number {
  if (!counts) return 0;
  return counts.form_submit + counts.email_capture;
}

/** LP conversion rate: conversions / unique LP page_views. */
export function lpConversionRate(counts: LpEventCounts | undefined): number {
  if (!counts) return 0;
  const conv = lpConversionsFor(counts);
  return counts.page_view > 0 ? conv / counts.page_view : 0;
}

/**
 * Get the latest sprint_metrics row per angle for the given sprint+channel.
 * Returns a map keyed by angle_id.
 */
export async function latestMetricsByAngle(
  sprintId: string,
  channel: string
): Promise<Map<string, { impressions: number; clicks: number; ctr: number; cpc_cents: number; spend_cents: number; leads: number }>> {
  const db = createServiceClient();
  // We pull the latest 200 rows ordered by polled_at desc and pick the first
  // entry per angle — sufficient for typical 3-angle sprints with hourly polls.
  const { data, error } = await db
    .from('sprint_metrics')
    .select('angle_id, impressions, clicks, ctr, cpc_cents, spend_cents, raw, polled_at')
    .eq('sprint_id', sprintId)
    .eq('channel', channel)
    .order('polled_at', { ascending: false })
    .limit(200);

  const out = new Map<string, { impressions: number; clicks: number; ctr: number; cpc_cents: number; spend_cents: number; leads: number }>();
  if (error || !data) return out;

  for (const row of data) {
    const angle = (row.angle_id as string | null) ?? null;
    if (!angle || out.has(angle)) continue;
    const raw = (row.raw as Record<string, unknown> | null) ?? {};
    const leads = Number(
      (raw['leads'] as number | undefined) ??
        ((raw['actions'] as Record<string, number> | undefined)?.['lead']) ??
        0
    );
    out.set(angle, {
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      ctr: Number(row.ctr ?? 0),
      cpc_cents: Number(row.cpc_cents ?? 0),
      spend_cents: Number(row.spend_cents ?? 0),
      leads,
    });
  }
  return out;
}

/**
 * Refresh sprint_angle_results for a sprint+channel by joining the latest
 * metrics snapshot with aggregated LP events. Returns the rows that were
 * upserted (post-aggregation) so callers can pick a winner for `angle_won`.
 */
export async function refreshSprintAngleResults(
  sprintId: string,
  channel: string
): Promise<AngleRollupRow[]> {
  const [metrics, lp] = await Promise.all([
    latestMetricsByAngle(sprintId, channel),
    aggregateLpEventsByAngle(sprintId),
  ]);

  const angles = new Set<string>([...metrics.keys(), ...lp.keys()]);
  const rows: AngleRollupRow[] = [];

  for (const angleId of angles) {
    if (angleId === 'unknown') continue; // skip un-attributed events
    const m = metrics.get(angleId);
    const c = lp.get(angleId) ?? EMPTY_LP_COUNTS;
    rows.push({
      sprint_id: sprintId,
      angle_id: angleId,
      channel,
      impressions: m?.impressions ?? 0,
      clicks: m?.clicks ?? 0,
      ctr: m?.ctr ?? 0,
      cpc_cents: m?.cpc_cents ?? 0,
      spend_cents: m?.spend_cents ?? 0,
      lp_views: c.page_view,
      lp_cta_clicks: c.cta_click,
      lp_form_submits: c.form_submit,
      lp_email_captures: c.email_capture,
      scroll_50_pct: c.scroll_50,
      scroll_75_pct: c.scroll_75,
      scroll_100_pct: c.scroll_100,
      meta_leads: m?.leads ?? 0,
    });
  }

  if (rows.length) {
    const db = createServiceClient();
    await db
      .from('sprint_angle_results')
      .upsert(
        rows.map((r) => ({ ...r, computed_at: new Date().toISOString() })),
        { onConflict: 'sprint_id,angle_id,channel' }
      );
  }
  return rows;
}

/**
 * Overlay normalized rollup rows onto a CampaignAgentOutput's angle_metrics.
 * The rollup is the source of truth for impressions/clicks/ctr/cpc/spend;
 * status is preserved from the existing in-blob entry (PASS/FAIL/PAUSED).
 *
 * Returns a NEW campaign object — does not mutate the input.
 */
export function overlayRollupOnCampaign<
  C extends {
    angle_metrics: Array<{
      id: string;
      impressions: number;
      clicks: number;
      ctr: number;
      cpc_cents: number;
      spend_cents: number;
      status: 'PASS' | 'FAIL' | 'PAUSED';
    }>;
    spent_cents: number;
  },
>(campaign: C, rollup: AngleRollupRow[]): C {
  if (!rollup.length) return campaign;
  const byId = new Map(rollup.map((r) => [r.angle_id, r]));
  const merged = campaign.angle_metrics.map((m) => {
    const r = byId.get(m.id);
    if (!r) return m;
    return {
      ...m,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr,
      cpc_cents: r.cpc_cents,
      spend_cents: r.spend_cents,
    };
  });
  const spent = merged.reduce((s, m) => s + m.spend_cents, 0);
  return { ...campaign, angle_metrics: merged, spent_cents: spent };
}

/**
 * Read sprint_angle_results for a sprint + channel.
 * Returns an empty array if none exist (e.g. legacy sprint or no polls yet).
 */
export async function getSprintAngleResults(
  sprintId: string,
  channel: string
): Promise<AngleRollupRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('sprint_angle_results')
    .select(
      'sprint_id, angle_id, channel, impressions, clicks, ctr, cpc_cents, spend_cents, lp_views, lp_cta_clicks, lp_form_submits, lp_email_captures, scroll_50_pct, scroll_75_pct, scroll_100_pct, meta_leads'
    )
    .eq('sprint_id', sprintId)
    .eq('channel', channel);
  if (error || !data) return [];
  return data.map((r) => ({
    sprint_id: r.sprint_id as string,
    angle_id: r.angle_id as string,
    channel: r.channel as string,
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    ctr: Number(r.ctr ?? 0),
    cpc_cents: Number(r.cpc_cents ?? 0),
    spend_cents: Number(r.spend_cents ?? 0),
    lp_views: Number(r.lp_views ?? 0),
    lp_cta_clicks: Number(r.lp_cta_clicks ?? 0),
    lp_form_submits: Number(r.lp_form_submits ?? 0),
    lp_email_captures: Number(r.lp_email_captures ?? 0),
    scroll_50_pct: Number(r.scroll_50_pct ?? 0),
    scroll_75_pct: Number(r.scroll_75_pct ?? 0),
    scroll_100_pct: Number(r.scroll_100_pct ?? 0),
    meta_leads: Number(r.meta_leads ?? 0),
  }));
}

/** Compute the LP conversion rate across all angles for verdict context. */
export function aggregateLpConversionRate(rollup: AngleRollupRow[]): number | null {
  if (!rollup.length) return null;
  const totalViews = rollup.reduce((s, r) => s + r.lp_views, 0);
  if (totalViews === 0) return null;
  const totalConv = rollup.reduce(
    (s, r) => s + r.lp_form_submits + r.lp_email_captures,
    0
  );
  return totalConv / totalViews;
}

/**
 * Pick the winning angle from rolled-up results.
 * Heuristic: highest LP conversion rate, with a min of 200 impressions to
 * avoid early-game noise. Ties broken by CTR.
 * Returns null if no angle meets the minimum.
 */
export function pickWinningAngle(
  rows: AngleRollupRow[],
  minImpressions = 200
): AngleRollupRow | null {
  const eligible = rows.filter((r) => r.impressions >= minImpressions);
  if (!eligible.length) return null;

  const scored = eligible.map((r) => {
    const cvr = r.lp_views > 0 ? (r.lp_form_submits + r.lp_email_captures) / r.lp_views : 0;
    return { row: r, cvr };
  });
  scored.sort((a, b) => b.cvr - a.cvr || b.row.ctr - a.row.ctr);
  return scored[0]?.row ?? null;
}
