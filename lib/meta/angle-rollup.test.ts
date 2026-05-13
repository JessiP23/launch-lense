import { describe, expect, it } from 'vitest';
import {
  pickWinningAngle,
  lpConversionsFor,
  lpConversionRate,
  overlayRollupOnCampaign,
  aggregateLpConversionRate,
  type AngleRollupRow,
} from './angle-rollup';

const baseRow = (over: Partial<AngleRollupRow>): AngleRollupRow => ({
  sprint_id: 's1',
  angle_id: 'A',
  channel: 'meta',
  impressions: 0,
  clicks: 0,
  ctr: 0,
  cpc_cents: 0,
  spend_cents: 0,
  lp_views: 0,
  lp_cta_clicks: 0,
  lp_form_submits: 0,
  lp_email_captures: 0,
  scroll_50_pct: 0,
  scroll_75_pct: 0,
  scroll_100_pct: 0,
  meta_leads: 0,
  ...over,
});

describe('lpConversionsFor', () => {
  it('sums form_submit + email_capture and tolerates undefined', () => {
    expect(lpConversionsFor(undefined)).toBe(0);
    expect(
      lpConversionsFor({
        page_view: 100,
        cta_click: 10,
        form_submit: 3,
        email_capture: 2,
        scroll_50: 0,
        scroll_75: 0,
        scroll_100: 0,
      })
    ).toBe(5);
  });
});

describe('lpConversionRate', () => {
  it('returns 0 when there are no views', () => {
    expect(
      lpConversionRate({
        page_view: 0,
        cta_click: 0,
        form_submit: 5,
        email_capture: 0,
        scroll_50: 0,
        scroll_75: 0,
        scroll_100: 0,
      })
    ).toBe(0);
  });
  it('divides conversions by views', () => {
    expect(
      lpConversionRate({
        page_view: 200,
        cta_click: 30,
        form_submit: 10,
        email_capture: 6,
        scroll_50: 0,
        scroll_75: 0,
        scroll_100: 0,
      })
    ).toBeCloseTo(0.08);
  });
});

describe('pickWinningAngle', () => {
  it('returns null when no angle has enough impressions', () => {
    const rows = [
      baseRow({ angle_id: 'A', impressions: 100, lp_views: 50, lp_form_submits: 10 }),
      baseRow({ angle_id: 'B', impressions: 50, lp_views: 50, lp_form_submits: 20 }),
    ];
    expect(pickWinningAngle(rows, 200)).toBeNull();
  });

  it('picks the angle with the highest LP conversion rate', () => {
    const rows = [
      // A: 5% cvr, high impressions
      baseRow({
        angle_id: 'A',
        impressions: 2000,
        ctr: 0.02,
        lp_views: 200,
        lp_form_submits: 10,
      }),
      // B: 10% cvr, fewer impressions but eligible
      baseRow({
        angle_id: 'B',
        impressions: 800,
        ctr: 0.015,
        lp_views: 100,
        lp_form_submits: 10,
      }),
    ];
    expect(pickWinningAngle(rows, 200)?.angle_id).toBe('B');
  });

  it('breaks ties by CTR', () => {
    const rows = [
      baseRow({
        angle_id: 'A',
        impressions: 1000,
        ctr: 0.01,
        lp_views: 100,
        lp_form_submits: 5,
      }),
      baseRow({
        angle_id: 'B',
        impressions: 1000,
        ctr: 0.03,
        lp_views: 100,
        lp_form_submits: 5,
      }),
    ];
    expect(pickWinningAngle(rows)?.angle_id).toBe('B');
  });
});

describe('overlayRollupOnCampaign', () => {
  const campaign = {
    angle_metrics: [
      { id: 'A', impressions: 0, clicks: 0, ctr: 0, cpc_cents: 0, spend_cents: 0, status: 'PASS' as const },
      { id: 'B', impressions: 5, clicks: 1, ctr: 0.2, cpc_cents: 100, spend_cents: 100, status: 'FAIL' as const },
    ],
    spent_cents: 100,
  };

  it('returns input unchanged when rollup is empty', () => {
    expect(overlayRollupOnCampaign(campaign, [])).toBe(campaign);
  });

  it('overlays metrics, preserves status, and recomputes spent_cents', () => {
    const rollup = [
      baseRow({ angle_id: 'A', impressions: 1000, clicks: 30, ctr: 0.03, cpc_cents: 80, spend_cents: 2400 }),
      baseRow({ angle_id: 'B', impressions: 500, clicks: 8, ctr: 0.016, cpc_cents: 125, spend_cents: 1000 }),
    ];
    const out = overlayRollupOnCampaign(campaign, rollup);
    expect(out.angle_metrics[0]).toMatchObject({
      id: 'A',
      impressions: 1000,
      clicks: 30,
      ctr: 0.03,
      cpc_cents: 80,
      spend_cents: 2400,
      status: 'PASS', // preserved from input
    });
    // Status must be preserved on each angle (FAIL stays FAIL).
    expect(out.angle_metrics[1].status).toBe('FAIL');
    expect(out.spent_cents).toBe(3400);
    // Original campaign object must not be mutated.
    expect(campaign.angle_metrics[0].impressions).toBe(0);
  });

  it('leaves angles without a rollup row untouched', () => {
    const rollup = [
      baseRow({ angle_id: 'A', impressions: 1000, clicks: 30, ctr: 0.03, cpc_cents: 80, spend_cents: 2400 }),
    ];
    const out = overlayRollupOnCampaign(campaign, rollup);
    expect(out.angle_metrics[1].impressions).toBe(5); // B unchanged
    expect(out.spent_cents).toBe(2500); // 2400 (A from rollup) + 100 (B preserved)
  });
});

describe('aggregateLpConversionRate', () => {
  it('returns null for empty rollup', () => {
    expect(aggregateLpConversionRate([])).toBeNull();
  });
  it('returns null when no LP views', () => {
    expect(
      aggregateLpConversionRate([
        baseRow({ angle_id: 'A', lp_views: 0, lp_form_submits: 5 }),
      ])
    ).toBeNull();
  });
  it('sums form_submits + email_captures over total views', () => {
    const rate = aggregateLpConversionRate([
      baseRow({ angle_id: 'A', lp_views: 200, lp_form_submits: 10, lp_email_captures: 4 }),
      baseRow({ angle_id: 'B', lp_views: 100, lp_form_submits: 2, lp_email_captures: 0 }),
    ]);
    // (10+4 + 2+0) / (200+100) = 16/300
    expect(rate).toBeCloseTo(16 / 300);
  });
});
