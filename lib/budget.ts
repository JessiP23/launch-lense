import type { Platform } from '@/lib/agents/types';

export const MIN_CHANNEL_USD = 50;
export const MAX_CHANNEL_USD = 500;
export const PLATFORM_FEE_USD = 49;
export const PLATFORM_FEE_CENTS = 4900;

export type ChannelBudgetUsd = Partial<Record<Platform, number>>;

/** Validate user budgets (USD) for channels that are part of the sprint. */
export function validateChannelBudgets(activeChannels: Platform[], budgetsUsd: ChannelBudgetUsd): {
  allocationCents: Partial<Record<Platform, number>>;
  adSpendCents: number;
  error?: string;
} {
  const allocationCents: Partial<Record<Platform, number>> = {};
  let adSpendCents = 0;

  for (const ch of activeChannels) {
    const usd = budgetsUsd[ch];
    if (usd == null || usd === 0) continue;
    if (typeof usd !== 'number' || Number.isNaN(usd)) {
    return { allocationCents: {}, adSpendCents: 0, error: `Invalid amount for ${ch}` };
    }
    if (usd < MIN_CHANNEL_USD || usd > MAX_CHANNEL_USD) {
      return {
        allocationCents: {},
        adSpendCents: 0,
        error: `${ch}: budget must be between $${MIN_CHANNEL_USD} and $${MAX_CHANNEL_USD}`,
      };
    }
    const cents = Math.round(usd * 100);
    allocationCents[ch] = cents;
    adSpendCents += cents;
  }

  const keys = Object.keys(allocationCents) as Platform[];
  if (keys.length === 0) {
    return { allocationCents: {}, adSpendCents: 0, error: 'Select at least one channel and set spend.' };
  }

  return { allocationCents, adSpendCents };
}
