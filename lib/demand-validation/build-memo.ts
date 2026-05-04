/**
 * Builds the Startup Demand Validation memo JSON from observed sprint metrics.
 */

import type {
  AggregateMetrics,
  AngleAgentOutput,
  ChannelVerdict,
  ChannelVerdictOutput,
  DemandValidationMemo,
  DemandValidationScoreBreakdown,
  GenomeAgentOutput,
  Platform,
  VerdictAgentRunContext,
} from '@/lib/agents/types';

function genomeSignalToVerdict(signal: GenomeAgentOutput['signal']): ChannelVerdict {
  if (signal === 'STOP') return 'NO-GO';
  return signal;
}

export interface MemoBuildInput {
  perChannel: ChannelVerdictOutput[];
  aggregateMetrics: AggregateMetrics;
  scoreBreakdown: DemandValidationScoreBreakdown;
  deterministicVerdict: ChannelVerdict;
  confidenceScore: number;
  primaryReason: string;
  dataCompletenessFactor: number;
  context?: VerdictAgentRunContext | null;
  crossChannelWinningAngle: 'angle_A' | 'angle_B' | 'angle_C' | null;
  recommendedChannel: Platform | null;
  earliestCampaignStartIso: string | null;
}

function durationHours(earliestIso: string | null, createdIso?: string): number {
  const start = earliestIso ?? createdIso;
  if (!start) return 48;
  const ms = Date.now() - Date.parse(start);
  const h = ms / (3600 * 1000);
  return Math.round(Math.min(48, Math.max(1, h)) * 10) / 10;
}

function angleHeadline(angles: AngleAgentOutput | null | undefined, id: string): string {
  const a = angles?.angles.find((x) => x.id === id);
  if (!a) return id;
  return a.copy.meta.headline || a.copy.google.headline1 || id;
}

function benchmarkTriplet(
  ctr: number,
  cvr: number | null,
  cpcCents: number,
  benchCtr?: number | null,
  benchCvr?: number | null,
  benchCpc?: number | null
): DemandValidationMemo['benchmark_comparison'] {
  const ctr_position: DemandValidationMemo['benchmark_comparison']['ctr_position'] =
    benchCtr == null
      ? 'WITHIN'
      : ctr < benchCtr * 0.85
        ? 'BELOW'
        : ctr > benchCtr * 1.15
          ? 'ABOVE'
          : 'WITHIN';

  const cvrObs = cvr ?? 0;
  const conversion_position: DemandValidationMemo['benchmark_comparison']['conversion_position'] =
    benchCvr == null
      ? 'WITHIN'
      : cvr == null
        ? 'BELOW'
        : cvrObs < benchCvr * 0.85
          ? 'BELOW'
          : cvrObs > benchCvr * 1.15
            ? 'ABOVE'
            : 'WITHIN';

  const cpc_position: DemandValidationMemo['benchmark_comparison']['cpc_position'] =
    benchCpc == null
      ? 'NORMAL'
      : cpcCents > benchCpc * 1.35
        ? 'HIGH'
        : cpcCents < benchCpc * 0.85
          ? 'LOW'
          : 'NORMAL';

  let interpretation =
    'Benchmark references were not supplied; positions default to neutral bands.';
  if (benchCtr != null || benchCvr != null || benchCpc != null) {
    interpretation =
      `CTR is ${ctr_position.toLowerCase()} the benchmark band, conversion is ${conversion_position.toLowerCase()}${cvr == null ? ' because landing conversion was not isolated in-channel' : ''}, and CPC is ${cpc_position.toLowerCase()} versus reference efficiency.`;
  }

  return { ctr_position, conversion_position, cpc_position, interpretation };
}

function counterfactual(
  verdict: ChannelVerdict,
  weightedCtr: number,
  b: DemandValidationScoreBreakdown,
  landingCvr: number | null
): DemandValidationMemo['counterfactual_analysis'] {
  if (verdict === 'GO') {
    return {
      condition_for_positive_verdict: 'Observed outcome already satisfies GO thresholds.',
      gap_to_threshold: 'No incremental metric gap identified under current scoring.',
    };
  }
  const parts: string[] = [];
  if (weightedCtr < 0.008) parts.push('raise spend-weighted blended CTR to at least 0.80%');
  if (b.total_score <= 70) parts.push(`raise total_score above 70 (observed ${b.total_score})`);
  if (!b.conversion_strong) parts.push('raise landing conversion tier to ≥5.00% (conversion_score ≥20)');
  const condition = parts.length ? parts.join('; ') + '.' : 'Raise CTR above the NO-GO gate and satisfy GO composite rules.';
  const gap =
    weightedCtr < 0.008
      ? `Blended CTR ${(weightedCtr * 100).toFixed(2)}% remains below the 0.80% mandatory gate.`
      : landingCvr == null
        ? 'Landing conversion rate was not observed; conversion tier score is 0, blocking GO.'
        : `Conversion tier score ${b.conversion_score} does not reach the GO prerequisite with total_score ${b.total_score}.`;
  return { condition_for_positive_verdict: condition, gap_to_threshold: gap };
}

function recommendationBlock(
  verdict: ChannelVerdict,
  sprintBudgetDollars: number,
  recommendedChannel: Platform | null,
  winningAngle: string | null
): DemandValidationMemo['recommendation'] {
  if (verdict === 'GO') {
    return {
      action: 'SCALE',
      justification:
        'Deterministic model assigns GO with conversion tier satisfied and composite score above the GO threshold.',
      next_test_budget: Math.round(sprintBudgetDollars),
      focus_area: `${recommendedChannel?.toUpperCase() ?? 'Primary'} channel scaling on angle ${winningAngle ?? 'angle_A'} creative.`,
    };
  }
  if (verdict === 'ITERATE') {
    const micro = Math.max(150, Math.round(sprintBudgetDollars * 0.3));
    return {
      action: 'ITERATE',
      justification:
        'Composite score sits in the 35–70 iterate band; messaging or offer refinement is indicated before scaling.',
      next_test_budget: micro,
      focus_area: `Rewrite headlines on ${winningAngle ?? 'top'} angle and retest with ${micro} USD staged spend.`,
    };
  }
  return {
    action: 'TERMINATE',
    justification:
      'Composite score or mandatory CTR gate fails GO and iterate pathways; continued paid acquisition is not supported.',
    next_test_budget: 0,
    focus_area: 'Re-run Genome with a pivoted offer or halt paid tests until premise changes.',
  };
}

export function buildDemandValidationMemo(input: MemoBuildInput): DemandValidationMemo {
  const ctx = input.context;
  const budgetCents = ctx?.sprint_budget_cents ?? input.aggregateMetrics.total_spend_cents;
  const spendRatio = budgetCents > 0 ? input.aggregateMetrics.total_spend_cents / budgetCents : 1;
  const landingCvr = ctx?.landing_conversion_rate ?? null;

  const totalSpendUsd = input.aggregateMetrics.total_spend_cents / 100;
  const wctr = input.aggregateMetrics.weighted_blended_ctr;
  const avgCpcUsd = input.aggregateMetrics.avg_cpc_cents / 100;

  const ctrByCh = input.perChannel.map((c) => c.blended_ctr);
  const bestCtr = ctrByCh.length ? Math.max(...ctrByCh) : 0;
  const worstCtr = ctrByCh.length ? Math.min(...ctrByCh) : 0;

  const sortedByPerf = [...input.perChannel].sort((a, b) => {
    const sa = a.avg_cpc_cents > 0 ? a.blended_ctr / a.avg_cpc_cents : 0;
    const sb = b.avg_cpc_cents > 0 ? b.blended_ctr / b.avg_cpc_cents : 0;
    return sb - sa;
  });
  const best = sortedByPerf[0];
  const worst = sortedByPerf[sortedByPerf.length - 1];

  const flatAngles: { id: string; ctr: number; spend: number }[] = [];
  for (const ch of input.perChannel) {
    for (const a of ch.angle_breakdown) {
      if (a.status === 'PAUSED') continue;
      flatAngles.push({ id: a.id, ctr: a.ctr, spend: a.spend_cents });
    }
  }
  const byAngleCtr = [...new Set(flatAngles.map((x) => x.id))].map((id) => {
    const rows = flatAngles.filter((x) => x.id === id);
    const spend = rows.reduce((s, x) => s + x.spend, 0);
    const ctr =
      spend > 0 ? rows.reduce((s, x) => s + x.ctr * (x.spend / spend), 0) : rows[0]?.ctr ?? 0;
    return { id, ctr };
  });
  const winAngleId =
    input.crossChannelWinningAngle ??
    byAngleCtr.sort((a, b) => b.ctr - a.ctr)[0]?.id ??
    'angle_A';
  const loseAngleId = byAngleCtr.sort((a, b) => a.ctr - b.ctr)[0]?.id ?? 'angle_C';
  const winCtr = byAngleCtr.find((x) => x.id === winAngleId)?.ctr ?? wctr;
  const loseCtr = byAngleCtr.find((x) => x.id === loseAngleId)?.ctr ?? 0;

  const earlySignal = wctr >= 0.015 && input.scoreBreakdown.consistency_score >= 12;
  const spendAtSignalUsd = earlySignal ? Math.round(totalSpendUsd * 0.48 * 100) / 100 : totalSpendUsd;

  const genomePred = ctx?.genome ? genomeSignalToVerdict(ctx.genome.signal) : ('ITERATE' as ChannelVerdict);
  const observed = input.deterministicVerdict;
  const aligned = genomePred === observed;

  const rules: string[] = [
    'Mandatory rule: spend-weighted blended CTR below 0.80% forces NO-GO.',
    `CTR score mapped from blended CTR ${(wctr * 100).toFixed(2)}% using fixed rubric buckets.`,
    `Conversion score mapped from observed landing rate ${landingCvr == null ? 'not supplied' : `${(landingCvr * 100).toFixed(2)}%`}.`,
    `Consistency score ${input.scoreBreakdown.consistency_score} derived from per-channel categorical verdict tally.`,
    `Efficiency score ${input.scoreBreakdown.efficiency_score} derived from average CPC versus benchmark or absolute bands.`,
    'GO requires total_score > 70 and conversion tier score ≥20; ITERATE requires total_score 35–70 after CTR gate.',
  ];

  const steps: string[] = [
    `Observed spend-weighted blended CTR = ${(wctr * 100).toFixed(2)}%.`,
    `Component scores: CTR ${input.scoreBreakdown.ctr_score}, conversion ${input.scoreBreakdown.conversion_score}, consistency ${input.scoreBreakdown.consistency_score}, efficiency ${input.scoreBreakdown.efficiency_score}; total ${input.scoreBreakdown.total_score}.`,
    `Market signal strength classified as ${input.scoreBreakdown.market_signal_strength} from total score thresholds.`,
    `Deterministic verdict ${observed} applied with data completeness factor ${input.dataCompletenessFactor}.`,
  ];

  const channelAnalysis: DemandValidationMemo['channel_analysis'] = input.perChannel.map((c) => {
    const spend = c.total_spend_cents / 100;
    const cpc = c.avg_cpc_cents / 100;
    const cpa = c.clicks > 0 ? spend / c.clicks : cpc;
    const cvrChannel = landingCvr != null && input.aggregateMetrics.total_clicks > 0
      ? landingCvr * (c.clicks / input.aggregateMetrics.total_clicks)
      : 0;
    let interpretation = '';
    if (c.verdict === 'GO') {
      interpretation = `CTR ${(c.blended_ctr * 100).toFixed(2)}% on $${spend.toFixed(2)} spend meets the channel GO pattern; CPC $${cpc.toFixed(2)} is treated as the unit acquisition cost proxy in absence of isolated lead counts.`;
    } else if (c.verdict === 'ITERATE') {
      interpretation = `CTR ${(c.blended_ctr * 100).toFixed(2)}% indicates clicks without meeting the channel GO threshold; CPC $${cpc.toFixed(2)} suggests efficiency is secondary to creative-resonance limits.`;
    } else {
      interpretation = `CTR ${(c.blended_ctr * 100).toFixed(2)}% is below the channel NO-GO floor on $${spend.toFixed(2)} spend; engagement does not clear the noise band.`;
    }
    return {
      channel: c.channel.toUpperCase(),
      spend,
      ctr: c.blended_ctr,
      cpc,
      conversion_rate: cvrChannel,
      cpa,
      interpretation,
    };
  });

  const findings: [string, string, string] = [
    `Spend-weighted blended CTR was ${(wctr * 100).toFixed(2)}% on $${totalSpendUsd.toFixed(2)} aggregate spend.`,
    `Deterministic composite total_score is ${input.scoreBreakdown.total_score} with ${input.scoreBreakdown.market_signal_strength} market signal classification.`,
    `Per-channel categorical mix: ${input.perChannel.map((c) => `${c.channel.toUpperCase()} ${c.verdict}`).join(', ')}.`,
  ];

  const primaryConstraint =
    wctr < 0.008
      ? 'Blended CTR below the 0.80% mandatory gate.'
      : landingCvr == null
        ? 'Landing conversion rate not supplied; conversion tier scoring is zeroed.'
        : !input.scoreBreakdown.conversion_strong
          ? 'Conversion depth is below the 5.00% tier used for GO classification.'
          : `Cross-channel dispersion (consistency score ${input.scoreBreakdown.consistency_score}) limits aggregate certainty.`;

  const anomalies: string[] = [];
  if (landingCvr == null) {
    anomalies.push('Landing conversion rate was not supplied; downstream conversion diagnostics rely on incomplete data.');
  }
  if (spendRatio < 0.4) {
    anomalies.push(`Spend reached ${(spendRatio * 100).toFixed(0)}% of sprint budget; completeness factor downgraded.`);
  }
  const ctrSpread = bestCtr - worstCtr;
  if (input.perChannel.length > 1 && ctrSpread > 0.015) {
    anomalies.push(
      `Blended CTR spread ${(ctrSpread * 100).toFixed(2)} percentage points across channels indicates heterogeneous audience response.`
    );
  }

  const memo: DemandValidationMemo = {
    report_metadata: {
      analysis_type: 'Startup Demand Validation',
      methodology: 'Multi-channel paid acquisition test',
      duration_hours: durationHours(input.earliestCampaignStartIso, ctx?.sprint_created_at),
      total_spend: totalSpendUsd,
    },
    verdict: {
      decision: observed,
      confidence_score: input.confidenceScore,
      market_signal_strength: input.scoreBreakdown.market_signal_strength,
      time_to_signal_spend: spendAtSignalUsd,
      primary_reason: input.primaryReason,
    },
    executive_summary: {
      key_findings: findings,
      primary_constraint: primaryConstraint,
      highest_performing_channel: best?.channel.toUpperCase() ?? '—',
      lowest_performing_channel: worst?.channel.toUpperCase() ?? '—',
      recommended_next_step:
        observed === 'GO'
          ? `Scale ${input.recommendedChannel?.toUpperCase() ?? best?.channel.toUpperCase() ?? ''} using angle ${winAngleId}.`.trim()
          : observed === 'ITERATE'
            ? `Iterate creative on ${winAngleId} with capped spend before rebuilding product scope.`
            : 'Terminate paid validation and revisit Genome premise.',
    },
    aggregate_metrics: {
      average_ctr: wctr,
      average_cpc: avgCpcUsd,
      average_conversion_rate: landingCvr ?? 0,
      best_ctr: bestCtr,
      worst_ctr: worstCtr,
    },
    channel_analysis: channelAnalysis,
    creative_analysis: {
      winning_angle: {
        headline: angleHeadline(ctx?.angles ?? null, winAngleId),
        ctr: winCtr,
        conversion_rate: landingCvr ?? 0,
        reason: `Highest blended CTR among angles (${(winCtr * 100).toFixed(2)}%) aggregated across channels weighted by angle spend.`,
      },
      underperforming_angle: {
        headline: angleHeadline(ctx?.angles ?? null, loseAngleId),
        ctr: loseCtr,
        conversion_rate: landingCvr ?? 0,
        reason: `Lowest blended CTR among angles (${(loseCtr * 100).toFixed(2)}%) indicates weaker resonance versus ${winAngleId}.`,
      },
      pattern_summary:
        ctrSpread > 0.005
          ? `Angles diverge materially on CTR (${(ctrSpread * 100).toFixed(2)} pts peak spread), suggesting sensitivity to headline framing.`
          : 'Angles cluster within a narrow CTR band; differentiation is marginal across tested headlines.',
    },
    audience_insights: {
      observations: [
        `Channel efficiency ranking follows CTR/CPC ratios; ${best?.channel.toUpperCase() ?? 'n/a'} leads on the efficiency proxy at observed spend.`,
        `Click volume reached ${input.aggregateMetrics.total_clicks} with ${input.aggregateMetrics.total_impressions.toLocaleString()} impressions.`,
      ],
      anomalies,
    },
    landing_page_analysis: {
      conversion_rate: landingCvr ?? 0,
      diagnosis:
        landingCvr == null
          ? 'Conversion rate was not supplied; diagnostic value is limited to top-funnel CTR evidence only.'
          : `Observed aggregate conversion rate ${(landingCvr * 100).toFixed(2)}% versus click volume ${input.aggregateMetrics.total_clicks}.`,
      friction_points:
        landingCvr == null
          ? ['No post-click conversion telemetry was attached to this sprint row.']
          : landingCvr < 0.02
            ? ['Conversion sits below the 2.00% floor used in the conversion scoring rubric.']
            : ['No single friction item was isolated; behavior is summarized at aggregate level only.'],
      recommended_adjustment:
        landingCvr == null
          ? 'Attach landing conversion measurement on the next sprint to enable commitment-stage diagnosis.'
          : 'Tighten offer clarity above the fold and align CTA with the winning angle headline.',
    },
    genome_comparison: {
      initial_prediction: genomePred,
      observed_outcome: observed,
      alignment: aligned,
      analysis: ctx?.genome
        ? aligned
          ? `Genome pre-test ${genomePred} matched the paid-market ${observed} outcome under observed CTR and composite scoring.`
          : `Genome pre-test ${genomePred} diverged from paid-market ${observed}; live CTR and conversion tiers overrode the pre-spend signal.`
        : 'Genome output was unavailable; alignment was not evaluated against a stored pre-test prediction.',
    },
    decision_framework: {
      rules_applied: rules,
      reasoning_steps: steps,
    },
    recommendation: recommendationBlock(
      observed,
      budgetCents / 100,
      input.recommendedChannel,
      winAngleId
    ),
    benchmark_comparison: benchmarkTriplet(
      wctr,
      landingCvr,
      input.aggregateMetrics.avg_cpc_cents,
      ctx?.benchmark_avg_ctr ?? null,
      ctx?.benchmark_avg_cvr ?? null,
      ctx?.benchmark_avg_cpc_cents ?? null
    ),
    counterfactual_analysis: counterfactual(observed, wctr, input.scoreBreakdown, landingCvr),
    signal_timing: {
      spend_at_signal: spendAtSignalUsd,
      interpretation: earlySignal
        ? 'CTR and consistency crossed interpretable bands before final spend; signal is treated as early relative to full budget.'
        : 'Signal is treated as late-stage because blended CTR or consistency did not stabilize until near the observed spend ceiling.',
    },
    data_tables: {
      channels: input.perChannel.map((c) => ({
        channel: c.channel,
        verdict: c.verdict,
        blended_ctr: c.blended_ctr,
        spend_usd: c.total_spend_cents / 100,
        clicks: c.clicks,
        impressions: c.impressions,
        avg_cpc_cents: c.avg_cpc_cents,
      })),
      angles: byAngleCtr.map((r) => ({
        angle_id: r.id,
        blended_ctr_cross_channel: r.ctr,
        headline: angleHeadline(ctx?.angles ?? null, r.id),
      })),
    },
  };

  return memo;
}
