/**
 * Sprint validation report — @react-pdf/renderer only.
 * Visual language follows the LaunchLense light memo (white canvas, verdict colors, DM Sans).
 */

import React from 'react';
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { ChannelVerdict, Platform, SprintRecord } from '@/lib/agents/types';
import { CHANNEL_CTR_THRESHOLDS } from '@/lib/agents/verdict';

export interface ReportBenchmarkSnapshot {
  avg_ctr: number;
  avg_cvr: number;
  avg_cpa_cents: number;
}

Font.register({
  family: 'DM Sans',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/dm-sans@5.0.3/files/dm-sans-latin-400-normal.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/dm-sans@5.0.3/files/dm-sans-latin-400-italic.woff2',
      fontWeight: 400,
      fontStyle: 'italic',
    },
    /* Fontsource dm-sans has no latin-*-600-* files — use weight 500 (Medium) everywhere we want semibold. */
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/dm-sans@5.0.3/files/dm-sans-latin-500-normal.woff2',
      fontWeight: 500,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/dm-sans@5.0.3/files/dm-sans-latin-700-normal.woff2',
      fontWeight: 700,
    },
  ],
});

Font.register({
  family: 'DM Mono',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/dm-mono@5.0.3/files/dm-mono-latin-400-normal.woff2',
      fontWeight: 400,
    },
  ],
});

const C = {
  white: '#FFFFFF',
  canvas: '#F7F6F3',
  ink: '#111110',
  ink2: '#3A3936',
  muted: '#7A7772',
  border: '#E4E0D8',
  faint: '#F0EDE8',
  go: '#059669',
  goBg: '#ECFDF5',
  goBorder: '#A7F3D0',
  wa: '#D97706',
  waBg: '#FFFBEB',
  waBorder: '#FDE68A',
  no: '#DC2626',
  noBg: '#FEF2F2',
  noBorder: '#FECACA',
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'DM Sans',
    fontSize: 10,
    color: C.ink,
    padding: 40,
    backgroundColor: C.white,
  },
  pageMuted: {
    fontFamily: 'DM Sans',
    fontSize: 10,
    color: C.ink,
    padding: 40,
    backgroundColor: C.canvas,
  },
  mono: { fontFamily: 'DM Mono' },
  coverTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  logo: { fontSize: 11, fontWeight: 500 },
  logoEm: { color: C.muted, fontWeight: 400 },
  coverMeta: { fontSize: 8, color: C.muted, textAlign: 'right', lineHeight: 1.5 },
  coverTag: {
    fontSize: 8,
    fontWeight: 500,
    color: C.muted,
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  coverIdea: {
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.2,
    maxWidth: 420,
    marginBottom: 20,
  },
  verdictBadge: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
  },
  vbWord: { fontSize: 32, fontWeight: 700, marginRight: 16 },
  vbCol: {
    borderLeftWidth: 1,
    borderLeftColor: C.border,
    paddingLeft: 14,
    justifyContent: 'center',
  },
  vbLbl: {
    fontSize: 8,
    fontWeight: 500,
    color: C.muted,
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  vbScore: { fontSize: 16, fontWeight: 700 },
  vbSig: { fontSize: 8, fontWeight: 500, marginTop: 4, textTransform: 'uppercase' },
  coverHeadline: { fontSize: 11, color: C.ink2, lineHeight: 1.5, marginBottom: 10 },
  coverAction: { fontSize: 10, color: C.muted },
  coverActionStrong: { color: C.ink, fontWeight: 500 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 20 },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  cfLabel: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: C.muted,
    fontWeight: 500,
  },
  cfVal: { fontSize: 9, fontWeight: 500, marginTop: 3 },
  chTag: {
    fontSize: 7,
    fontWeight: 700,
    padding: '3 6',
    backgroundColor: C.faint,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 3,
    marginRight: 4,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  sectionLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: C.muted,
    letterSpacing: 1.4,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    textTransform: 'uppercase',
  },
  execGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    marginBottom: 12,
  },
  execCell: {
    width: '50%',
    padding: 12,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
    minHeight: 52,
  },
  ecLbl: {
    fontSize: 8,
    color: C.muted,
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.8,
  },
  ecVal: { fontSize: 10, fontWeight: 500, lineHeight: 1.35 },
  bullet: {
    backgroundColor: C.faint,
    borderRadius: 5,
    padding: 8,
    marginBottom: 5,
    fontSize: 9,
    color: C.ink2,
    lineHeight: 1.45,
  },
  actionBox: {
    backgroundColor: C.ink,
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionLbl: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.8,
  },
  actionTxt: { fontSize: 11, color: C.white, fontWeight: 500, maxWidth: 420 },
  kpiRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    marginBottom: 10,
    overflow: 'hidden',
  },
  kpiCell: {
    flex: 1,
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: C.border,
    alignItems: 'center',
  },
  kpiVal: { fontSize: 16, fontWeight: 700 },
  kpiLbl: {
    fontSize: 7,
    color: C.muted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  kpiBench: { fontSize: 7, color: '#D4D0C8', marginTop: 2, fontFamily: 'DM Mono' },
  interp: {
    backgroundColor: C.faint,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 5,
    padding: 10,
    fontSize: 9,
    color: C.ink2,
    lineHeight: 1.5,
    marginBottom: 8,
  },
  chCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    marginBottom: 8,
  },
  chHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: C.faint,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  chName: { fontSize: 10, fontWeight: 700 },
  pill: {
    fontSize: 7,
    fontWeight: 700,
    padding: '3 7',
    borderRadius: 10,
    overflow: 'hidden',
  },
  chSub: { fontSize: 7, color: C.muted, fontFamily: 'DM Mono', marginTop: 2 },
  chMetrics: { flexDirection: 'row', borderTopWidth: 0 },
  chM: {
    flex: 1,
    padding: 8,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  chMval: { fontSize: 11, fontWeight: 700 },
  chMl: { fontSize: 7, color: C.muted, marginTop: 2, textTransform: 'uppercase' },
  chInsight: { padding: 10, fontSize: 9, color: C.ink2, lineHeight: 1.45 },
  chNext: {
    padding: 8,
    fontSize: 9,
    fontWeight: 500,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.faint, paddingVertical: 5 },
  th: {
    flex: 1,
    fontSize: 7,
    fontWeight: 700,
    color: C.muted,
    textTransform: 'uppercase',
    padding: 6,
    backgroundColor: C.faint,
  },
  td: { flex: 1, fontSize: 8, padding: 6, color: C.ink2 },
  genomeAxis: {
    width: '33%',
    padding: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 5,
    marginBottom: 6,
    marginRight: 4,
  },
  gRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  hgCard: {
    width: '48%',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 5,
    marginBottom: 8,
    marginRight: '2%',
  },
  hgHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: C.faint,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  logicRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  logicNum: {
    width: 34,
    fontSize: 9,
    fontFamily: 'DM Mono',
    color: C.muted,
    padding: 8,
    backgroundColor: C.faint,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  logicTxt: { flex: 1, fontSize: 9, padding: 8, lineHeight: 1.45, color: C.ink2 },
  recHead: { backgroundColor: C.ink, padding: 16, borderRadius: 4, marginBottom: 0 },
  recAction: { fontSize: 22, fontWeight: 700, color: '#4ADE80', marginTop: 4 },
  recActionIt: { color: '#FBB040' },
  recActionKill: { color: '#F87171' },
  recBody: { borderWidth: 1, borderColor: C.border, borderTopWidth: 0 },
  recCell: { padding: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  invNote: {
    padding: 12,
    backgroundColor: C.faint,
    fontSize: 9,
    fontStyle: 'italic',
    color: C.ink2,
    lineHeight: 1.45,
  },
  foot: {
    position: 'absolute',
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 7,
    color: C.muted,
    textAlign: 'center',
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 6,
  },
});

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function fmtPct(r: number, d = 2): string {
  return `${(r * 100).toFixed(d)}%`;
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n));
}

function verdictColors(v: ChannelVerdict | string): { bg: string; border: string; word: string } {
  if (v === 'GO') return { bg: C.goBg, border: C.goBorder, word: C.go };
  if (v === 'ITERATE') return { bg: C.waBg, border: C.waBorder, word: C.wa };
  return { bg: C.noBg, border: C.noBorder, word: C.no };
}

function signalColor(s: string): string {
  if (s === 'STRONG') return C.go;
  if (s === 'MODERATE') return C.wa;
  return C.no;
}

function platformFromLabel(label: string): Platform | null {
  const k = label.toLowerCase() as Platform;
  return CHANNEL_CTR_THRESHOLDS[k] ? k : null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Full memo-backed report */
function MemoReport({ sprint, benchmark }: { sprint: SprintRecord; benchmark: ReportBenchmarkSnapshot | null }) {
  const memo = sprint.verdict!.demand_validation!.memo!;
  const v = sprint.verdict!;
  const agg = v.aggregate_metrics;
  const totalScore = v.demand_validation?.scores.total_score;
  const bench = benchmark;
  const marketCtr = bench ? fmtPct(bench.avg_ctr) : '—';
  const marketCvr = bench ? fmtPct(bench.avg_cvr) : '—';
  const marketCpc = bench ? fmtUsd(bench.avg_cpa_cents / 100) : '—';

  const vb = verdictColors(memo.verdict.decision);
  const channels = sprint.active_channels;

  const signals = [...memo.executive_summary.key_findings, ...memo.audience_insights.observations.slice(0, 3)].slice(
    0,
    6
  );

  const channelPages = chunk(memo.channel_analysis, 2);

  const genome = sprint.genome;
  const scores = genome?.scores;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.coverTop}>
          <Text style={styles.logo}>
            LaunchLense <Text style={styles.logoEm}>· Validation Report</Text>
          </Text>
          <View>
            <Text style={styles.coverMeta}>
              Sprint: LL-{sprint.sprint_id.slice(0, 8).toUpperCase()}
              {'\n'}
              Generated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {'\n'}
              Window: {memo.report_metadata.duration_hours.toFixed(0)}h reference
            </Text>
          </View>
        </View>
        <Text style={styles.coverTag}>Startup Validation · Real Ad Data</Text>
        <Text style={styles.coverIdea}>{sprint.idea}</Text>
        <View style={[styles.verdictBadge, { backgroundColor: vb.bg, borderColor: vb.border }]}>
          <Text style={[styles.vbWord, { color: vb.word }]}>{memo.verdict.decision}</Text>
          <View style={styles.vbCol}>
            <Text style={styles.vbLbl}>Confidence Score</Text>
            <Text style={styles.vbScore}>{memo.verdict.confidence_score} / 100</Text>
            <Text style={[styles.vbSig, { color: signalColor(memo.verdict.market_signal_strength) }]}>
              {memo.verdict.market_signal_strength} signal
            </Text>
          </View>
        </View>
        <Text style={styles.coverHeadline} wrap>
          {memo.genome_comparison.analysis}{' '}
          {agg ? `${fmtPct(agg.weighted_blended_ctr)} weighted CTR · ${fmtUsd(memo.report_metadata.total_spend)} spend.` : ''}
        </Text>
        <Text style={styles.coverAction} wrap>
          Next: <Text style={styles.coverActionStrong}>{memo.executive_summary.recommended_next_step}</Text>
        </Text>
        <View style={styles.divider} />
        <View style={styles.footerRow}>
          <View style={{ maxWidth: 200 }}>
            <Text style={styles.cfLabel}>Channels Tested</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 }}>
              {channels.map((ch) => (
                <Text key={ch} style={styles.chTag}>
                  {ch.toUpperCase()}
                </Text>
              ))}
            </View>
          </View>
          <View>
            <Text style={styles.cfLabel}>Total Spend</Text>
            <Text style={styles.cfVal}>{fmtUsd(memo.report_metadata.total_spend)}</Text>
          </View>
          <View>
            <Text style={styles.cfLabel}>Impressions</Text>
            <Text style={styles.cfVal}>{fmtNum(agg?.total_impressions ?? 0)}</Text>
          </View>
          <View>
            <Text style={styles.cfLabel}>Demand score</Text>
            <Text style={styles.cfVal}>
              {memo.verdict.market_signal_strength} · {totalScore ?? '—'}/100
            </Text>
          </View>
        </View>
        <Text style={styles.foot} fixed>
          LaunchLense · Demand validation memo v1 · Page 1
        </Text>
      </Page>

      <Page size="A4" style={styles.pageMuted}>
        <Text style={styles.sectionLabel}>Executive summary · 01</Text>
        <View style={styles.execGrid}>
          <View style={styles.execCell}>
            <Text style={styles.ecLbl}>Dominant channel</Text>
            <Text style={[styles.ecVal, { color: C.go }]}>{memo.executive_summary.highest_performing_channel}</Text>
          </View>
          <View style={styles.execCell}>
            <Text style={styles.ecLbl}>Failing channel</Text>
            <Text style={[styles.ecVal, { color: C.wa }]}>{memo.executive_summary.lowest_performing_channel}</Text>
          </View>
          <View style={styles.execCell}>
            <Text style={styles.ecLbl}>Cross-channel winner</Text>
            <Text style={styles.ecVal}>{memo.creative_analysis.winning_angle.headline.slice(0, 80)}</Text>
          </View>
          <View style={styles.execCell}>
            <Text style={styles.ecLbl}>Main constraint</Text>
            <Text style={styles.ecVal} wrap>
              {memo.executive_summary.primary_constraint}
            </Text>
          </View>
        </View>
        {signals.map((s, i) => (
          <Text key={i} style={styles.bullet} wrap>
            {String(i + 1).padStart(2, '0')} {s}
          </Text>
        ))}
        <View style={styles.actionBox}>
          <View>
            <Text style={styles.actionLbl}>Recommended next action</Text>
            <Text style={styles.actionTxt} wrap>
              {memo.executive_summary.recommended_next_step}
            </Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>→</Text>
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 22 }]}>Performance core · 02</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCell}>
            <Text style={[styles.kpiVal, { color: C.go }]}>{fmtUsd(memo.report_metadata.total_spend)}</Text>
            <Text style={styles.kpiLbl}>Total spend</Text>
            <Text style={styles.kpiBench}>Budget {fmtUsd((sprint.budget_cents ?? 0) / 100)}</Text>
          </View>
          <View style={styles.kpiCell}>
            <Text style={[styles.kpiVal, { color: C.go }]}>{fmtPct(memo.aggregate_metrics.average_ctr)}</Text>
            <Text style={styles.kpiLbl}>Weighted CTR</Text>
            <Text style={styles.kpiBench}>Mkt {marketCtr}</Text>
          </View>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiVal}>{fmtUsd(memo.aggregate_metrics.average_cpc)}</Text>
            <Text style={styles.kpiLbl}>Avg CPC</Text>
            <Text style={styles.kpiBench}>Mkt {marketCpc}</Text>
          </View>
          <View style={styles.kpiCell}>
            <Text style={[styles.kpiVal, { color: C.go }]}>{fmtNum(agg?.total_impressions ?? 0)}</Text>
            <Text style={styles.kpiLbl}>Impressions</Text>
            <Text style={styles.kpiBench}>{fmtNum(agg?.total_clicks ?? 0)} clicks</Text>
          </View>
          <View style={[styles.kpiCell, { borderRightWidth: 0 }]}>
            <Text style={[styles.kpiVal, { color: memo.aggregate_metrics.average_conversion_rate >= 0.05 ? C.go : C.wa }]}>
              {fmtPct(memo.aggregate_metrics.average_conversion_rate)}
            </Text>
            <Text style={styles.kpiLbl}>Conv. rate</Text>
            <Text style={styles.kpiBench}>Ref {marketCvr}</Text>
          </View>
        </View>
        <Text style={styles.interp} wrap>
          {memo.benchmark_comparison.interpretation} {memo.landing_page_analysis.diagnosis}
        </Text>
        <Text style={styles.foot} fixed>
          LaunchLense · Page 2
        </Text>
      </Page>

      {channelPages.map((group, pi) => (
        <Page key={pi} size="A4" style={styles.pageMuted}>
          <Text style={styles.sectionLabel}>Channel breakdown · 03 ({pi + 1}/{channelPages.length})</Text>
          {group.map((row) => {
            const plat = platformFromLabel(row.channel);
            const goTh = plat ? fmtPct(CHANNEL_CTR_THRESHOLDS[plat].go_ctr_threshold, 1) : '—';
            const pc = v.per_channel?.find((c) => c.channel.toUpperCase() === row.channel);
            const cv = pc?.verdict ?? ('NO-GO' as ChannelVerdict);
            const vc = verdictColors(cv);
            const nextBg = cv === 'GO' ? C.goBg : cv === 'ITERATE' ? C.waBg : C.noBg;
            const nextFg = cv === 'GO' ? C.go : cv === 'ITERATE' ? C.wa : C.no;
            return (
              <View key={row.channel} style={styles.chCard}>
                <View style={styles.chHead}>
                  <View>
                    <Text style={styles.chName}>{row.channel}</Text>
                    <Text style={[styles.pill, { backgroundColor: vc.bg, borderWidth: 1, borderColor: vc.border, color: vc.word, alignSelf: 'flex-start', marginTop: 4 }]}>
                      {cv}
                    </Text>
                  </View>
                  <Text style={styles.chSub}>
                    Threshold ≥ {goTh} CTR · Observed {fmtPct(row.ctr)}
                  </Text>
                </View>
                <View style={styles.chMetrics}>
                  <View style={styles.chM}>
                    <Text style={[styles.chMval, { color: vc.word }]}>{fmtPct(row.ctr)}</Text>
                    <Text style={styles.chMl}>Blended CTR</Text>
                  </View>
                  <View style={styles.chM}>
                    <Text style={styles.chMval}>{fmtUsd(row.cpc)}</Text>
                    <Text style={styles.chMl}>Avg CPC</Text>
                  </View>
                  <View style={styles.chM}>
                    <Text style={styles.chMval}>{fmtUsd(row.spend)}</Text>
                    <Text style={styles.chMl}>Spend</Text>
                  </View>
                  <View style={[styles.chM, { borderRightWidth: 0 }]}>
                    <Text style={styles.chMval}>{fmtNum(pc?.impressions ?? 0)}</Text>
                    <Text style={styles.chMl}>Impressions</Text>
                  </View>
                </View>
                <Text style={styles.chInsight} wrap>
                  {row.interpretation}
                </Text>
                <Text style={[styles.chNext, { backgroundColor: nextBg, color: nextFg }]} wrap>
                  {pc?.next_action ?? memo.recommendation.focus_area}
                </Text>
              </View>
            );
          })}
          <Text style={styles.foot} fixed>
            LaunchLense · Page {3 + pi}
          </Text>
        </Page>
      ))}

      <Page size="A4" style={styles.pageMuted}>
        <Text style={styles.sectionLabel}>Creative analysis · 04</Text>
        <Text style={styles.interp} wrap>
          Win: {memo.creative_analysis.winning_angle.headline} — {memo.creative_analysis.winning_angle.reason}
        </Text>
        <Text style={styles.interp} wrap>
          Under: {memo.creative_analysis.underperforming_angle.headline} — {memo.creative_analysis.underperforming_angle.reason}
        </Text>
        <Text style={styles.bullet} wrap>
          Pattern: {memo.creative_analysis.pattern_summary}
        </Text>

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Genome pre-screen · 05</Text>
        {genome ? (
          <>
            <Text style={styles.bullet} wrap>
              Signal {genome.signal} · Composite {genome.composite}/100 · {genome.icp}
            </Text>
            <View style={styles.gRow}>
              {scores &&
                (
                  [
                    ['Demand', scores.demand],
                    ['ICP', scores.icp],
                    ['Competition', scores.competition],
                    ['Timing', scores.timing],
                    ['Moat', scores.moat],
                  ] as const
                ).map(([label, val]) => (
                  <View key={label} style={styles.genomeAxis}>
                    <Text style={{ fontSize: 7, color: C.muted, marginBottom: 4 }}>{label}</Text>
                    <Text style={{ fontSize: 16, fontWeight: 700 }}>{val}</Text>
                  </View>
                ))}
            </View>
            {genome.risks.slice(0, 4).map((r, i) => (
              <Text key={i} style={styles.bullet} wrap>
                {r}
              </Text>
            ))}
          </>
        ) : (
          <Text style={styles.interp}>Genome not stored on this sprint.</Text>
        )}

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Healthgate™ · 06</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {sprint.healthgate
            ? Object.entries(sprint.healthgate).map(([ch, hg]) => (
                <View key={ch} style={styles.hgCard}>
                  <View style={styles.hgHead}>
                    <Text style={{ fontSize: 10, fontWeight: 700 }}>{ch.toUpperCase()}</Text>
                    <Text style={{ fontSize: 14, fontWeight: 700 }}>{hg.score}</Text>
                  </View>
                  {hg.checks.slice(0, 6).map((ck) => (
                    <View key={ck.key} style={styles.row}>
                      <Text style={{ fontSize: 8, flex: 1 }}>{ck.name}</Text>
                      <Text style={{ fontSize: 7, fontWeight: 700, color: ck.passed ? C.go : C.no }}>
                        {ck.passed ? 'PASS' : 'FAIL'}
                      </Text>
                    </View>
                  ))}
                </View>
              ))
            : (
                <Text style={styles.interp}>No Healthgate snapshots.</Text>
              )}
        </View>
        <Text style={styles.foot} fixed>
          LaunchLense · Page {3 + channelPages.length}
        </Text>
      </Page>

      <Page size="A4" style={styles.pageMuted}>
        <Text style={styles.sectionLabel}>Decision logic · 07</Text>
        <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 5, marginBottom: 8 }}>
          {memo.decision_framework.reasoning_steps.map((step, i) => (
            <View key={i} style={styles.logicRow}>
              <Text style={styles.logicNum}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={styles.logicTxt} wrap>
                {step}
              </Text>
            </View>
          ))}
          {memo.decision_framework.rules_applied.map((rule, i) => (
            <View key={`r-${i}`} style={styles.logicRow}>
              <Text style={styles.logicNum}>R</Text>
              <Text style={styles.logicTxt} wrap>
                {rule}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.interp} wrap>
          Sensitivity: {memo.counterfactual_analysis.gap_to_threshold} · Timing: {memo.signal_timing.interpretation}
        </Text>

        <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Final recommendation · 08</Text>
        <View style={styles.recHead}>
          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>Action</Text>
          <Text
            style={{
              ...styles.recAction,
              ...(memo.recommendation.action === 'ITERATE' ? styles.recActionIt : {}),
              ...(memo.recommendation.action === 'TERMINATE' ? styles.recActionKill : {}),
            }}
          >
            {memo.recommendation.action}
          </Text>
        </View>
        <View style={styles.recBody}>
          <View style={styles.recCell}>
            <Text style={{ fontSize: 8, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Focus</Text>
            <Text wrap>{memo.recommendation.focus_area}</Text>
          </View>
          <View style={styles.recCell}>
            <Text style={{ fontSize: 8, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Next test budget</Text>
            <Text>{fmtUsd(memo.recommendation.next_test_budget)}</Text>
          </View>
          <View style={styles.recCell}>
            <Text style={{ fontSize: 8, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Justification</Text>
            <Text wrap>{memo.recommendation.justification}</Text>
          </View>
          <Text style={styles.invNote} wrap>
            Genome alignment: {memo.genome_comparison.alignment ? 'Yes' : 'No'} — {memo.genome_comparison.analysis}
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Benchmark · counterfactual · outreach · 09–11</Text>
        <Text style={styles.bullet} wrap>
          CTR {memo.benchmark_comparison.ctr_position} · Conv {memo.benchmark_comparison.conversion_position} · CPC{' '}
          {memo.benchmark_comparison.cpc_position}
        </Text>
        <Text style={styles.interp} wrap>
          Flip condition: {memo.counterfactual_analysis.condition_for_positive_verdict}
        </Text>
        <Text style={styles.interp} wrap>
          Outreach: {sprint.post_sprint?.outreach ? sprint.post_sprint.outreach.subjectLine : 'Not executed'} · Contacts{' '}
          {sprint.post_sprint?.spreadsheet?.validContacts ?? 0} validated
        </Text>
        <Text style={styles.foot} fixed>
          LaunchLense · Page {4 + channelPages.length}
        </Text>
      </Page>
    </Document>
  );
}

/** Older sprints without demand_validation.memo */
function FallbackSprintPdf({ sprint }: { sprint: SprintRecord }) {
  const verdict = sprint.verdict;
  const metrics = verdict?.aggregate_metrics;
  const verdictLabel = verdict?.verdict ?? 'PENDING';
  const vc = verdictColors(verdictLabel);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.logo}>LaunchLense · Sprint report</Text>
        <Text style={{ fontSize: 9, color: C.muted, marginBottom: 16 }}>LL-{sprint.sprint_id.slice(0, 8).toUpperCase()}</Text>
        <Text style={styles.coverIdea}>{sprint.idea}</Text>
        <View style={[styles.verdictBadge, { backgroundColor: vc.bg, borderColor: vc.border }]}>
          <Text style={[styles.vbWord, { color: vc.word }]}>{verdictLabel}</Text>
          <View style={styles.vbCol}>
            <Text style={styles.vbLbl}>Confidence</Text>
            <Text style={styles.vbScore}>{verdict?.confidence ?? '—'} / 100</Text>
          </View>
        </View>
        <Text style={styles.coverHeadline} wrap>
          {verdict?.reasoning ?? sprint.blocked_reason ?? 'Re-run VerdictAgent to attach the structured demand_validation memo.'}
        </Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiVal}>{fmtUsd((metrics?.total_spend_cents ?? 0) / 100)}</Text>
            <Text style={styles.kpiLbl}>Spend</Text>
          </View>
          <View style={styles.kpiCell}>
            <Text style={styles.kpiVal}>{fmtPct(metrics?.weighted_blended_ctr ?? 0)}</Text>
            <Text style={styles.kpiLbl}>Weighted CTR</Text>
          </View>
          <View style={[styles.kpiCell, { borderRightWidth: 0 }]}>
            <Text style={styles.kpiVal}>{metrics?.total_clicks ?? 0}</Text>
            <Text style={styles.kpiLbl}>Clicks</Text>
          </View>
        </View>
        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Per-channel</Text>
        {(verdict?.per_channel ?? []).map((c) => (
          <Text key={c.channel} style={styles.bullet} wrap>
            {c.channel.toUpperCase()} · {c.verdict} · {fmtPct(c.blended_ctr)} CTR
          </Text>
        ))}
        <Text style={styles.foot} fixed>
          LaunchLense · Fallback export · Upgrade verdict pipeline for full memo layout
        </Text>
      </Page>
    </Document>
  );
}

export function SprintValidationReportDocument({
  sprint,
  benchmark,
}: {
  sprint: SprintRecord;
  benchmark?: ReportBenchmarkSnapshot | null;
}) {
  if (sprint.verdict?.demand_validation?.memo) {
    return <MemoReport sprint={sprint} benchmark={benchmark ?? null} />;
  }
  return <FallbackSprintPdf sprint={sprint} />;
}
