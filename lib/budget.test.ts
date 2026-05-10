import { describe, expect, it } from 'vitest';
import type { Platform } from '@/lib/agents/types';
import { validateChannelBudgets, MIN_CHANNEL_USD, MAX_CHANNEL_USD, PLATFORM_FEE_CENTS } from '@/lib/budget';

describe('validateChannelBudgets', () => {
  it('accepts valid per-channel USD and sums cents', () => {
    const active = ['meta', 'google'] as Platform[];
    const r = validateChannelBudgets(active, { meta: 100, google: 200 });
    expect(r.error).toBeUndefined();
    expect(r.adSpendCents).toBe(30_000);
    expect(r.allocationCents.meta).toBe(10_000);
    expect(r.allocationCents.google).toBe(20_000);
  });

  it('rejects amounts below minimum', () => {
    const active = ['meta'] as Platform[];
    const r = validateChannelBudgets(active, { meta: MIN_CHANNEL_USD - 1 });
    expect(r.error).toBeDefined();
  });

  it('rejects amounts above maximum', () => {
    const active = ['meta'] as Platform[];
    const r = validateChannelBudgets(active, { meta: MAX_CHANNEL_USD + 1 });
    expect(r.error).toBeDefined();
  });

  it('requires at least one channel with budget', () => {
    const active = ['meta', 'tiktok'] as Platform[];
    const r = validateChannelBudgets(active, {});
    expect(r.error).toMatch(/Select at least one/i);
  });
});

describe('platform fee constant', () => {
  it('matches $49', () => {
    expect(PLATFORM_FEE_CENTS).toBe(4900);
  });
});
