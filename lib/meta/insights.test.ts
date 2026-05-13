import { describe, expect, it } from 'vitest';
import { evaluatePauseRules, DEFAULT_PAUSE_THRESHOLDS } from './insights';

const base = {
  adset_id: 'a',
  adset_name: 'A',
  impressions: 1000,
  clicks: 10,
  ctr: 0.01,
  cpc_cents: 100,
  spend_cents: 1000,
  actions: {},
  date_start: '',
  date_stop: '',
};

describe('evaluatePauseRules', () => {
  it('does not pause healthy adset', () => {
    expect(evaluatePauseRules(base, 1).pause).toBe(false);
  });

  it('pauses when CTR is below threshold after minimum impressions', () => {
    const lowCtr = { ...base, ctr: 0.001 };
    const d = evaluatePauseRules(lowCtr, 0);
    expect(d.pause).toBe(true);
    expect(d.reason).toMatch(/CTR/);
  });

  it('does not pause low-CTR adset below impression minimum', () => {
    const newAdset = { ...base, impressions: 100, ctr: 0.001 };
    expect(evaluatePauseRules(newAdset, 0).pause).toBe(false);
  });

  it('pauses when CPC ceiling exceeded', () => {
    const expensive = { ...base, cpc_cents: DEFAULT_PAUSE_THRESHOLDS.cpcPauseAboveCents + 1 };
    const d = evaluatePauseRules(expensive, 1);
    expect(d.pause).toBe(true);
    expect(d.reason).toMatch(/CPC/);
  });

  it('pauses when spend ceiling reached with zero conversions', () => {
    const dry = {
      ...base,
      spend_cents: DEFAULT_PAUSE_THRESHOLDS.noConversionSpendCeilingCents + 1,
    };
    const d = evaluatePauseRules(dry, 0);
    expect(d.pause).toBe(true);
    expect(d.reason).toMatch(/no LP conversions/);
  });

  it('does not pause when conversions exist even above spend ceiling', () => {
    const dry = {
      ...base,
      spend_cents: DEFAULT_PAUSE_THRESHOLDS.noConversionSpendCeilingCents + 1,
    };
    expect(evaluatePauseRules(dry, 1).pause).toBe(false);
  });
});
