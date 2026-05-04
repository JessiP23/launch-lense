/**
 * Deterministic demand-validation scoring — same inputs yield same outputs.
 */

import type { ChannelVerdict, DemandValidationScoreBreakdown } from '@/lib/agents/types';

export interface ScoringInput {
  /** Spend-weighted blended CTR across channels (0–1). */
  weighted_avg_ctr: number;
  /** Aggregate landing conversion rate (0–1), null when not observed. */
  landing_conversion_rate: number | null;
  /** Verdict category per completed channel (same order as active test). */
  per_channel_verdicts: ChannelVerdict[];
  avg_cpc_cents: number;
  benchmark_avg_cpc_cents?: number | null;
  /** Sum(spend) / sprint_budget (may exceed 1 if overspend). */
  spend_ratio_of_budget: number;
}

export function computeCtrScore(avgCtr: number): number {
  if (avgCtr < 0.008) return 0;
  if (avgCtr < 0.012) return 10;
  if (avgCtr < 0.02) return 25;
  return 40;
}

export function computeConversionScore(rate: number | null): number {
  if (rate == null || Number.isNaN(rate)) return 0;
  if (rate < 0.02) return 0;
  if (rate < 0.05) return 10;
  if (rate < 0.1) return 20;
  return 30;
}

/** conversion_strong = conversion_score tier ≥ 5% observed rate (score ≥ 20). */
export function conversionStrong(conversionScore: number): boolean {
  return conversionScore >= 20;
}

export function computeConsistencyScore(verdicts: ChannelVerdict[]): number {
  const go = verdicts.filter((v) => v === 'GO').length;
  const iter = verdicts.filter((v) => v === 'ITERATE').length;
  if (go >= 2) return 20;
  if (go + iter >= 2) return 12;
  if (go === 1 || iter >= 1) return 5;
  return 0;
}

export function computeEfficiencyScore(
  avgCpcCents: number,
  benchmarkAvgCpcCents?: number | null
): number {
  if (benchmarkAvgCpcCents != null && benchmarkAvgCpcCents > 0) {
    const ratio = avgCpcCents / benchmarkAvgCpcCents;
    if (ratio > 1.5) return 2;
    if (ratio > 0.9) return 6;
    return 10;
  }
  if (avgCpcCents >= 400) return 2;
  if (avgCpcCents >= 100) return 6;
  return 10;
}

export function marketSignalStrength(total: number): DemandValidationScoreBreakdown['market_signal_strength'] {
  if (total < 30) return 'WEAK';
  if (total <= 65) return 'MODERATE';
  return 'STRONG';
}

export function dataCompletenessFactor(spendRatio: number): 50 | 70 | 100 {
  if (spendRatio >= 0.7) return 100;
  if (spendRatio >= 0.4) return 70;
  return 50;
}

export function computeConfidenceScore(
  totalScore: number,
  consistencyScore: number,
  completeness: 50 | 70 | 100
): number {
  const normalizedConsistency = (consistencyScore / 20) * 100;
  const raw = totalScore * 0.6 + normalizedConsistency * 0.3 + completeness * 0.1;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Strict aggregate verdict — overrides legacy spend-weighted jury logic.
 */
export function deterministicAggregateVerdict(
  weightedAvgCtr: number,
  breakdown: DemandValidationScoreBreakdown
): ChannelVerdict {
  if (weightedAvgCtr < 0.008) return 'NO-GO';
  const { total_score, conversion_strong } = breakdown;
  if (total_score > 70 && conversion_strong) return 'GO';
  if (total_score >= 35 && total_score <= 70) return 'ITERATE';
  return 'NO-GO';
}

export function computeDemandValidationScoreBreakdown(input: ScoringInput): DemandValidationScoreBreakdown {
  const ctr_score = computeCtrScore(input.weighted_avg_ctr);
  const conversion_score = computeConversionScore(input.landing_conversion_rate);
  const consistency_score = computeConsistencyScore(input.per_channel_verdicts);
  const efficiency_score = computeEfficiencyScore(input.avg_cpc_cents, input.benchmark_avg_cpc_cents);
  const total_score = ctr_score + conversion_score + consistency_score + efficiency_score;
  return {
    ctr_score,
    conversion_score,
    consistency_score,
    efficiency_score,
    total_score,
    market_signal_strength: marketSignalStrength(total_score),
    conversion_strong: conversionStrong(conversion_score),
  };
}

export function computeDemandValidationScoring(input: ScoringInput): DemandValidationScoreBreakdown & {
  confidence_score: number;
  deterministic_verdict: ChannelVerdict;
  data_completeness_factor: 50 | 70 | 100;
  primary_reason: string;
} {
  const completeness = dataCompletenessFactor(input.spend_ratio_of_budget);
  const breakdown = computeDemandValidationScoreBreakdown(input);
  const deterministic_verdict = deterministicAggregateVerdict(input.weighted_avg_ctr, breakdown);
  const confidence_score = computeConfidenceScore(
    breakdown.total_score,
    breakdown.consistency_score,
    completeness
  );
  const primary_reason = primaryReasonForVerdict(
    deterministic_verdict,
    input.weighted_avg_ctr,
    breakdown
  );
  return {
    ...breakdown,
    confidence_score,
    deterministic_verdict,
    data_completeness_factor: completeness,
    primary_reason,
  };
}

function primaryReasonForVerdict(
  v: ChannelVerdict,
  weightedAvgCtr: number,
  b: DemandValidationScoreBreakdown
): string {
  const ctrPct = (weightedAvgCtr * 100).toFixed(2);
  if (weightedAvgCtr < 0.008) {
    return `Spend-weighted blended CTR ${ctrPct}% is below the 0.80% gate; classification follows the mandatory NO-GO threshold.`;
  }
  if (v === 'GO') {
    return `Total score ${b.total_score} exceeds 70 with conversion tier score ${b.conversion_score} (≥5% observed landing conversion tier), satisfying GO criteria at ${ctrPct}% blended CTR.`;
  }
  if (v === 'ITERATE') {
    return `Total score ${b.total_score} falls in the 35–70 band at ${ctrPct}% blended CTR; conversion tier score ${b.conversion_score} and consistency score ${b.consistency_score} indicate mixed but non-terminal signal.`;
  }
  return `Total score ${b.total_score} is outside the GO band or conversion tier score ${b.conversion_score} fails the ≥20-point requirement at ${ctrPct}% blended CTR.`;
}
