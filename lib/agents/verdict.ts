// ─────────────────────────────────────────────────────────────────────────────
// VerdictAgent — Per-channel verdicts + deterministic aggregate demand-validation model
// Per-channel: GO | ITERATE | NO-GO (channel-normalized CTR thresholds).
// Aggregate: mandatory CTR gate + weighted scoring rubric (see lib/demand-validation/scoring.ts).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Platform,
  VerdictAgentOutput,
  ChannelVerdictOutput,
  ChannelVerdict,
  AggregateMetrics,
  CampaignAgentOutput,
  VerdictAgentRunContext,
  DemandValidationScoreBreakdown,
} from './types';
import { computeDemandValidationScoring } from '@/lib/demand-validation/scoring';
import { buildDemandValidationMemo } from '@/lib/demand-validation/build-memo';

// ── Channel-specific CTR thresholds ───────────────────────────────────────

type ThresholdDef = {
  go_min_angles_above: number;
  go_ctr_threshold: number;
  iterate_single_above: number;
  iterate_blended_min: number;
  iterate_blended_max: number;
  nogo_all_below: number;
};

/** Channel-normalized CTR gates (for report copy + VerdictAgent). */
export const CHANNEL_CTR_THRESHOLDS: Record<Platform, ThresholdDef> = {
  meta: {
    go_min_angles_above: 2,
    go_ctr_threshold: 0.02,      // 2.0%
    iterate_single_above: 0.02,
    iterate_blended_min: 0.01,
    iterate_blended_max: 0.0199,
    nogo_all_below: 0.01,        // all angles below 1.0%
  },
  google: {
    go_min_angles_above: 2,
    go_ctr_threshold: 0.035,     // 3.5%
    iterate_single_above: 0.035,
    iterate_blended_min: 0.02,
    iterate_blended_max: 0.0349,
    nogo_all_below: 0.02,
  },
  linkedin: {
    go_min_angles_above: 2,
    go_ctr_threshold: 0.005,     // 0.5%
    iterate_single_above: 0.005,
    iterate_blended_min: 0.003,
    iterate_blended_max: 0.0049,
    nogo_all_below: 0.003,
  },
  tiktok: {
    go_min_angles_above: 2,
    go_ctr_threshold: 0.015,     // 1.5%
    iterate_single_above: 0.015,
    iterate_blended_min: 0.008,
    iterate_blended_max: 0.0149,
    nogo_all_below: 0.008,
  },
};

// ── Compute per-channel verdict ────────────────────────────────────────────

function scoreChannel(
  channel: Platform,
  campaign: CampaignAgentOutput
): ChannelVerdictOutput {
  const t = CHANNEL_CTR_THRESHOLDS[channel];
  const angles = campaign.angle_metrics;

  // Blended CTR weighted by spend
  const totalSpend = angles.reduce((s, a) => s + a.spend_cents, 0);
  const blendedCTR = totalSpend > 0
    ? angles.reduce((s, a) => s + a.ctr * (a.spend_cents / totalSpend), 0)
    : 0;

  const anglesAboveGo = angles.filter((a) => a.ctr >= t.go_ctr_threshold && a.status !== 'PAUSED').length;
  const hasSingleAbove = angles.some((a) => a.ctr >= t.iterate_single_above && a.status !== 'PAUSED');

  let verdict: ChannelVerdict;
  if (anglesAboveGo >= t.go_min_angles_above) {
    verdict = 'GO';
  } else if (hasSingleAbove || (blendedCTR >= t.iterate_blended_min && blendedCTR <= t.iterate_blended_max)) {
    verdict = 'ITERATE';
  } else {
    verdict = 'NO-GO';
  }

  // Winning angle: highest CTR / lowest CPC (score = CTR / CPC_cents, higher is better)
  const nonPaused = angles.filter((a) => a.status !== 'PAUSED' && a.impressions > 0);
  const winning = nonPaused.sort((a, b) => {
    const scoreA = a.cpc_cents > 0 ? a.ctr / a.cpc_cents : 0;
    const scoreB = b.cpc_cents > 0 ? b.ctr / b.cpc_cents : 0;
    return scoreB - scoreA;
  })[0];

  const totalClicks = angles.reduce((s, a) => s + a.clicks, 0);
  const totalImpressions = angles.reduce((s, a) => s + a.impressions, 0);
  const avgCPC = totalClicks > 0
    ? Math.round(angles.reduce((s, a) => s + a.cpc_cents * a.clicks, 0) / totalClicks)
    : 0;

  const ctrPct = (blendedCTR * 100).toFixed(2);
  const cpcDollars = (avgCPC / 100).toFixed(2);
  const spendDollars = (totalSpend / 100).toFixed(2);

  const reasoningMap: Record<ChannelVerdict, string> = {
    'GO': `${channel.toUpperCase()} delivered ${anglesAboveGo} angles above the ${(t.go_ctr_threshold * 100).toFixed(1)}% CTR threshold with a blended CTR of ${ctrPct}% on $${spendDollars} spend. Market demand for this framing is validated — proceed to build.`,
    'ITERATE': `${channel.toUpperCase()} produced a blended CTR of ${ctrPct}% ($${cpcDollars} avg CPC, $${spendDollars} total) — above the noise floor but below the GO threshold. The problem is real but the message needs refinement before building.`,
    'NO-GO': `${channel.toUpperCase()} returned a blended CTR of ${ctrPct}% across all angles — below the ${(t.nogo_all_below * 100).toFixed(1)}% minimum with $${spendDollars} spend. No angle resonated; this framing (or market) needs a fundamental pivot.`,
  };

  const nextActionMap: Record<ChannelVerdict, string> = {
    'GO': `Scale ${winning ? winning.id : 'winning'} angle on ${channel}. Double the creative budget and narrow targeting to the top-performing audience segment.`,
    'ITERATE': `Rewrite the ${winning ? winning.id : 'top'} angle's headline to more directly reflect the buyer's trigger event. Retest with a $150 micro-sprint before full build.`,
    'NO-GO': `Pause ${channel} spend. Run Genome with a pivoted idea framing before retesting. Do not rebuild the landing page — change the core message first.`,
  };

  // Confidence: higher blended CTR relative to threshold = higher confidence
  const confidence = Math.min(
    100,
    Math.round(
      verdict === 'GO' ? 70 + Math.min(30, (blendedCTR / t.go_ctr_threshold) * 15) :
      verdict === 'ITERATE' ? 40 + Math.min(25, (blendedCTR / t.go_ctr_threshold) * 30) :
      Math.max(10, 35 - Math.round((t.nogo_all_below - blendedCTR) / t.nogo_all_below * 20))
    )
  );

  return {
    channel,
    verdict,
    confidence,
    blended_ctr: blendedCTR,
    total_spend_cents: totalSpend,
    impressions: totalImpressions,
    clicks: totalClicks,
    avg_cpc_cents: avgCPC,
    winning_angle: winning?.id ?? null,
    angle_breakdown: angles.map((a) => ({
      id: a.id,
      ctr: a.ctr,
      cpc_cents: a.cpc_cents,
      spend_cents: a.spend_cents,
      status: a.status,
    })),
    reasoning: reasoningMap[verdict],
    next_action: nextActionMap[verdict],
  };
}

export async function runVerdictAgent(
  campaigns: Partial<Record<Platform, CampaignAgentOutput>>,
  context?: VerdictAgentRunContext | null
): Promise<VerdictAgentOutput> {
  const channelEntries = Object.entries(campaigns) as [Platform, CampaignAgentOutput][];
  const completed = channelEntries.filter(([, c]) => c.status === 'COMPLETE');

  if (completed.length === 0) {
    throw new Error('VerdictAgent: no completed campaigns to score.');
  }

  // Per-channel verdicts
  const perChannel: ChannelVerdictOutput[] = completed.map(([ch, camp]) => scoreChannel(ch, camp));

  // Aggregate metrics
  const totalSpend   = perChannel.reduce((s, c) => s + c.total_spend_cents, 0);
  const totalImpr    = perChannel.reduce((s, c) => s + c.impressions, 0);
  const totalClicks  = perChannel.reduce((s, c) => s + c.clicks, 0);
  const weightedCTR  = totalSpend > 0
    ? perChannel.reduce((s, c) => s + c.blended_ctr * (c.total_spend_cents / totalSpend), 0)
    : 0;
  const avgCPC       = totalClicks > 0
    ? Math.round(perChannel.reduce((s, c) => s + c.avg_cpc_cents * c.clicks, 0) / totalClicks)
    : 0;

  const aggregateMetrics: AggregateMetrics = {
    total_spend_cents: totalSpend,
    total_impressions: totalImpr,
    total_clicks: totalClicks,
    weighted_blended_ctr: weightedCTR,
    avg_cpc_cents: avgCPC,
  };

  let earliestStart: string | null = null;
  for (const [, camp] of completed) {
    const t = camp.campaign_start_time;
    if (!t) continue;
    if (!earliestStart || Date.parse(t) < Date.parse(earliestStart)) earliestStart = t;
  }

  // Cross-channel winning angle (spend-weighted CTR/CPC score)
  const angleScores: Record<string, number> = {};
  for (const c of perChannel) {
    for (const a of c.angle_breakdown) {
      const key = a.id;
      const score = a.cpc_cents > 0 ? (a.ctr / a.cpc_cents) * a.spend_cents : 0;
      angleScores[key] = (angleScores[key] ?? 0) + score;
    }
  }
  const crossChannelWinner = (Object.entries(angleScores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as
    'angle_A' | 'angle_B' | 'angle_C' | null;

  const bestChannel = perChannel
    .filter((c) => c.verdict !== 'NO-GO')
    .sort((a, b) => {
      const scoreA = a.avg_cpc_cents > 0 ? a.blended_ctr / a.avg_cpc_cents : 0;
      const scoreB = b.avg_cpc_cents > 0 ? b.blended_ctr / b.avg_cpc_cents : 0;
      return scoreB - scoreA;
    })[0];

  const budgetCents = context?.sprint_budget_cents ?? totalSpend;
  const spendRatio = budgetCents > 0 ? totalSpend / budgetCents : 1;

  const dvScoring = computeDemandValidationScoring({
    weighted_avg_ctr: weightedCTR,
    landing_conversion_rate: context?.landing_conversion_rate ?? null,
    per_channel_verdicts: perChannel.map((c) => c.verdict),
    avg_cpc_cents: avgCPC,
    benchmark_avg_cpc_cents: context?.benchmark_avg_cpc_cents ?? null,
    spend_ratio_of_budget: spendRatio,
  });

  const aggregateVerdict = dvScoring.deterministic_verdict;

  const scoreBreakdown: DemandValidationScoreBreakdown = {
    ctr_score: dvScoring.ctr_score,
    conversion_score: dvScoring.conversion_score,
    consistency_score: dvScoring.consistency_score,
    efficiency_score: dvScoring.efficiency_score,
    total_score: dvScoring.total_score,
    market_signal_strength: dvScoring.market_signal_strength,
    conversion_strong: dvScoring.conversion_strong,
  };

  const memo = buildDemandValidationMemo({
    perChannel,
    aggregateMetrics,
    scoreBreakdown,
    deterministicVerdict: aggregateVerdict,
    confidenceScore: dvScoring.confidence_score,
    primaryReason: dvScoring.primary_reason,
    dataCompletenessFactor: dvScoring.data_completeness_factor,
    context: context ?? undefined,
    crossChannelWinningAngle: crossChannelWinner,
    recommendedChannel: bestChannel?.channel ?? null,
    earliestCampaignStartIso: earliestStart,
  });

  // Channel verdicts map
  const channelVerdicts = Object.fromEntries(
    perChannel.map((c) => [c.channel, c.verdict])
  ) as Record<Platform, ChannelVerdict>;

  const confidence = dvScoring.confidence_score;

  // 3-sentence aggregate reasoning
  const goChannels   = perChannel.filter((c) => c.verdict === 'GO').map((c) => c.channel.toUpperCase());
  const iterChannels = perChannel.filter((c) => c.verdict === 'ITERATE').map((c) => c.channel.toUpperCase());
  const nogoChannels = perChannel.filter((c) => c.verdict === 'NO-GO').map((c) => c.channel.toUpperCase());
  const weightedCTRPct = (weightedCTR * 100).toFixed(2);
  const totalSpendDollars = (totalSpend / 100).toFixed(2);

  const reasoningParts: string[] = [];
  reasoningParts.push(
    `Deterministic aggregate verdict ${aggregateVerdict} (total_score ${dvScoring.total_score}/100, ${dvScoring.market_signal_strength} signal, confidence ${confidence}).`
  );
  if (goChannels.length) reasoningParts.push(`${goChannels.join(' and ')} returned GO verdicts — ${crossChannelWinner ?? 'angle_A'} was the cross-channel winning angle with the best CTR/CPC ratio.`);
  if (iterChannels.length) reasoningParts.push(`${iterChannels.join(' and ')} returned ITERATE — demand signal exists but messaging needs refinement.`);
  if (nogoChannels.length) reasoningParts.push(`${nogoChannels.join(' and ')} returned NO-GO — no angle resonated above threshold.`);
  reasoningParts.push(`Overall spend-weighted blended CTR was ${weightedCTRPct}% across $${totalSpendDollars} total spend — ${bestChannel ? `scale ${bestChannel.channel.toUpperCase()} first` : 'revisit Genome before scaling'}.`);

  const reasoning = reasoningParts.slice(0, 4).join(' ');

  return {
    verdict: aggregateVerdict,
    confidence,
    channel_verdicts: channelVerdicts,
    per_channel: perChannel,
    aggregate_metrics: aggregateMetrics,
    cross_channel_winning_angle: crossChannelWinner,
    reasoning,
    recommended_channel: bestChannel?.channel ?? null,
    demand_validation: {
      scores: scoreBreakdown,
      data_completeness_factor: dvScoring.data_completeness_factor,
      memo,
    },
  };
}
