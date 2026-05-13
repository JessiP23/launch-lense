// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — Meta Insights polling module
//
// Canonical entry point for fetching ad-set + ad-level performance metrics
// from the Marketing API. Wraps lib/meta-api.ts with extra fields
// (frequency, CPM, outbound clicks) and retry semantics.
//
// Used by the sprint-monitor cron and on-demand by the verdict pipeline.
// ─────────────────────────────────────────────────────────────────────────────

import {
  getAdsetInsights as _getAdsetInsights,
  getMultiAdsetInsights as _getMultiAdsetInsights,
  fetchAndEvaluateAngles as _fetchAndEvaluateAngles,
  pauseAdset,
  type AdsetInsights,
  type AngleCampaignMetrics,
} from '@/lib/meta-api';
import { withMetaRetry } from '@/lib/meta/retry';

export type { AdsetInsights, AngleCampaignMetrics };

// ── Extended insight fields (CPM, frequency, outbound) ─────────────────────

export interface ExtendedAdsetInsights extends AdsetInsights {
  cpm_cents: number;
  frequency: number;
  outbound_clicks: number;
}

const META_API_VERSION = 'v20.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface RawRow {
  adset_id?: string;
  adset_name?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  spend?: string;
  frequency?: string;
  outbound_clicks?: Array<{ action_type?: string; value?: string }>;
  actions?: Array<{ action_type: string; value: string }>;
  date_start?: string;
  date_stop?: string;
}

async function metaInsightFetch(path: string, accessToken: string): Promise<{ data?: RawRow[] }> {
  const url = new URL(`${META_BASE}${path}`);
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url.toString());
  const json = (await res.json()) as
    | { data?: RawRow[] }
    | { error: { message: string; type: string; code: number } };
  if ('error' in json) {
    const e = json.error;
    const err = new Error(e.message) as Error & { code?: number; type?: string };
    err.code = e.code;
    err.type = e.type;
    throw err;
  }
  return json;
}

/**
 * Extended adset insights including CPM, frequency, and outbound_clicks
 * (which Meta exposes only via this fields call). Retries on transient errors.
 */
export async function getExtendedAdsetInsights(
  adsetId: string,
  accessToken: string,
  dateRange?: { since: string; until: string }
): Promise<ExtendedAdsetInsights | null> {
  return withMetaRetry(
    async () => {
      const fields =
        'adset_id,adset_name,impressions,clicks,ctr,cpc,cpm,spend,frequency,outbound_clicks,actions';
      const tr = dateRange
        ? `&time_range={"since":"${dateRange.since}","until":"${dateRange.until}"}`
        : '';
      const raw = await metaInsightFetch(
        `/${adsetId}/insights?fields=${fields}${tr}&level=adset`,
        accessToken
      );
      const row = raw.data?.[0];
      if (!row) return null;

      const actions: Record<string, number> = {};
      for (const a of row.actions ?? []) actions[a.action_type] = parseFloat(a.value);

      const outbound = (row.outbound_clicks ?? []).reduce(
        (s, a) => s + parseFloat(a.value ?? '0'),
        0
      );
      const spendUsd = parseFloat(row.spend ?? '0');
      const clicks = parseInt(row.clicks ?? '0', 10);
      const impressions = parseInt(row.impressions ?? '0', 10);
      const cpc = parseFloat(row.cpc ?? '0');
      const cpm = parseFloat(row.cpm ?? '0');

      return {
        adset_id: row.adset_id ?? adsetId,
        adset_name: row.adset_name ?? '',
        impressions,
        clicks,
        ctr: parseFloat(row.ctr ?? '0') / 100,
        cpc_cents: Math.round(cpc * 100),
        cpm_cents: Math.round(cpm * 100),
        spend_cents: Math.round(spendUsd * 100),
        frequency: parseFloat(row.frequency ?? '0'),
        outbound_clicks: outbound,
        actions,
        date_start: row.date_start ?? '',
        date_stop: row.date_stop ?? '',
      };
    },
    { label: `insights:${adsetId}` }
  );
}

// ── Auto-pause rules (deterministic) ───────────────────────────────────────

export interface PauseDecision {
  pause: boolean;
  reason?: string;
}

export interface PauseThresholds {
  /** Minimum impressions before CTR-based pause can fire. */
  minImpressions?: number;
  /** Pause if CTR < this after minImpressions. */
  ctrPauseBelow?: number;
  /** Pause if CPC > this (USD cents) once we have clicks. */
  cpcPauseAboveCents?: number;
  /** Pause if spent more than this in cents without any LP conversion. */
  noConversionSpendCeilingCents?: number;
  /** Pause if frequency exceeds this. */
  frequencyCeiling?: number;
}

export const DEFAULT_PAUSE_THRESHOLDS: Required<PauseThresholds> = {
  minImpressions: 500,
  ctrPauseBelow: 0.003,                  // 0.3%
  cpcPauseAboveCents: 500,               // $5 CPC ceiling
  noConversionSpendCeilingCents: 2000,   // $20 with 0 leads → pause
  frequencyCeiling: 4.5,
};

/** Evaluate deterministic pause rules against an insight snapshot. */
export function evaluatePauseRules(
  insight: ExtendedAdsetInsights | AdsetInsights,
  lpConversions: number,
  thresholds: PauseThresholds = {}
): PauseDecision {
  const t = { ...DEFAULT_PAUSE_THRESHOLDS, ...thresholds };
  const ext = insight as Partial<ExtendedAdsetInsights>;

  if (insight.impressions >= t.minImpressions && insight.ctr < t.ctrPauseBelow) {
    return { pause: true, reason: `CTR ${(insight.ctr * 100).toFixed(2)}% below ${t.ctrPauseBelow * 100}%` };
  }
  if (insight.clicks > 0 && insight.cpc_cents > t.cpcPauseAboveCents) {
    return { pause: true, reason: `CPC $${(insight.cpc_cents / 100).toFixed(2)} above ceiling` };
  }
  if (insight.spend_cents >= t.noConversionSpendCeilingCents && lpConversions === 0) {
    return { pause: true, reason: `Spent $${(insight.spend_cents / 100).toFixed(2)} with no LP conversions` };
  }
  if (ext.frequency != null && ext.frequency > t.frequencyCeiling) {
    return { pause: true, reason: `Frequency ${ext.frequency.toFixed(2)} above ${t.frequencyCeiling}` };
  }
  return { pause: false };
}

// ── Re-exports for callers expecting the canonical module path ─────────────

export const getAdsetInsights = _getAdsetInsights;
export const getMultiAdsetInsights = _getMultiAdsetInsights;
export const fetchAndEvaluateAngles = _fetchAndEvaluateAngles;
export { pauseAdset };
