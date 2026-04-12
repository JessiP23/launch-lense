export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToStream,
  Font,
} from '@react-pdf/renderer';

// Register Geist-like font (fallback to Helvetica for reliability)
Font.register({
  family: 'Geist',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-400-normal.woff',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-700-normal.woff',
      fontWeight: 700,
    },
  ],
});

const colors = {
  bg: '#0A0A0A',
  card: '#171717',
  border: '#262626',
  text: '#FAFAFA',
  muted: '#A1A1A1',
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#EAB308',
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.bg,
    padding: 40,
    fontFamily: 'Geist',
    color: colors.text,
    fontSize: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    borderBottom: `1px solid ${colors.border}`,
    paddingBottom: 20,
  },
  logo: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: -0.5,
  },
  logoSub: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 2,
  },
  verdictBadge: {
    padding: '8 16',
    borderRadius: 4,
    fontSize: 16,
    fontWeight: 700,
    textAlign: 'center' as const,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
    border: `1px solid ${colors.border}`,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: colors.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottom: `0.5px solid ${colors.border}`,
  },
  rowLabel: {
    color: colors.muted,
    fontSize: 9,
  },
  rowValue: {
    fontWeight: 700,
    fontSize: 10,
    fontFeatureSettings: '"tnum"',
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 6,
    padding: 12,
    border: `1px solid ${colors.border}`,
    alignItems: 'center' as const,
  },
  kpiLabel: {
    fontSize: 8,
    color: colors.muted,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: 700,
  },
  kpiBenchmark: {
    fontSize: 7,
    color: colors.muted,
    marginTop: 2,
  },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottom: `0.5px solid ${colors.border}`,
  },
  pass: { color: colors.success },
  fail: { color: colors.danger },
  footer: {
    position: 'absolute' as const,
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center' as const,
    color: colors.muted,
    fontSize: 7,
    borderTop: `0.5px solid ${colors.border}`,
    paddingTop: 8,
  },
  savingsBox: {
    backgroundColor: colors.card,
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
    border: `1px solid ${colors.border}`,
    alignItems: 'center' as const,
  },
  savingsAmount: {
    fontSize: 22,
    fontWeight: 700,
    color: colors.success,
  },
  savingsLabel: {
    fontSize: 9,
    color: colors.muted,
    marginTop: 4,
  },
});

interface TestData {
  id: string;
  name: string;
  idea: string;
  vertical: string;
  verdict: string;
  budget_cents: number;
  created_at: string;
}

interface EventMetrics {
  spend_cents: number;
  impressions: number;
  clicks: number;
  lp_views: number;
  leads: number;
}

interface Benchmark {
  avg_ctr: number;
  avg_cvr: number;
  avg_cpa_cents: number;
}

function VerdictPDF({
  test,
  metrics,
  benchmark,
}: {
  test: TestData;
  metrics: EventMetrics;
  benchmark: Benchmark;
}) {
  const ctr = metrics.impressions > 0 ? metrics.clicks / metrics.impressions : 0;
  const cvr = metrics.lp_views > 0 ? metrics.leads / metrics.lp_views : 0;
  const cpaCents = metrics.leads > 0 ? metrics.spend_cents / metrics.leads : metrics.spend_cents;

  const verdictColor =
    test.verdict === 'GO' ? colors.success : test.verdict === 'NO-GO' ? colors.danger : colors.warning;

  const savedAmount = 35000; // $35k theoretical build cost

  // Verdict criteria checks
  const criteria = [
    {
      label: 'CPA vs Benchmark',
      actual: `$${(cpaCents / 100).toFixed(0)}`,
      required: `< $${(benchmark.avg_cpa_cents * 0.8 / 100).toFixed(0)}`,
      pass: cpaCents < benchmark.avg_cpa_cents * 0.8,
    },
    {
      label: 'Conversion Rate',
      actual: `${(cvr * 100).toFixed(2)}%`,
      required: '> 2.00%',
      pass: cvr > 0.02,
    },
    {
      label: 'Minimum Leads',
      actual: `${metrics.leads}`,
      required: '> 5',
      pass: metrics.leads > 5,
    },
  ];

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.logo }, 'LaunchLense'),
          React.createElement(
            Text,
            { style: styles.logoSub },
            `Ad Account Insurance • ${test.name}`
          )
        ),
        React.createElement(
          Text,
          {
            style: {
              ...styles.verdictBadge,
              backgroundColor: verdictColor + '20',
              color: verdictColor,
            },
          },
          test.verdict || 'PENDING'
        )
      ),
      // Savings callout
      React.createElement(
        View,
        { style: styles.savingsBox },
        React.createElement(
          Text,
          { style: styles.savingsAmount },
          `$${(metrics.spend_cents / 100).toFixed(0)} → saved $${savedAmount.toLocaleString()}`
        ),
        React.createElement(
          Text,
          { style: styles.savingsLabel },
          `ROI: ${((savedAmount / (metrics.spend_cents / 100 || 1)) * 100).toFixed(0)}% return on validation spend`
        )
      ),
      // KPI Grid
      React.createElement(
        View,
        { style: styles.kpiGrid },
        React.createElement(
          View,
          { style: styles.kpiCard },
          React.createElement(Text, { style: styles.kpiLabel }, 'TOTAL SPEND'),
          React.createElement(
            Text,
            { style: styles.kpiValue },
            `$${(metrics.spend_cents / 100).toFixed(0)}`
          ),
          React.createElement(
            Text,
            { style: styles.kpiBenchmark },
            `Budget: $${(test.budget_cents / 100).toFixed(0)}`
          )
        ),
        React.createElement(
          View,
          { style: styles.kpiCard },
          React.createElement(Text, { style: styles.kpiLabel }, 'LEADS'),
          React.createElement(Text, { style: styles.kpiValue }, `${metrics.leads}`),
          React.createElement(Text, { style: styles.kpiBenchmark }, `CVR: ${(cvr * 100).toFixed(2)}%`)
        ),
        React.createElement(
          View,
          { style: styles.kpiCard },
          React.createElement(Text, { style: styles.kpiLabel }, 'CPA'),
          React.createElement(
            Text,
            {
              style: {
                ...styles.kpiValue,
                color: cpaCents > benchmark.avg_cpa_cents ? colors.danger : colors.success,
              },
            },
            `$${(cpaCents / 100).toFixed(0)}`
          ),
          React.createElement(
            Text,
            { style: styles.kpiBenchmark },
            `Benchmark: $${(benchmark.avg_cpa_cents / 100).toFixed(0)}`
          )
        ),
        React.createElement(
          View,
          { style: styles.kpiCard },
          React.createElement(Text, { style: styles.kpiLabel }, 'CTR'),
          React.createElement(Text, { style: styles.kpiValue }, `${(ctr * 100).toFixed(2)}%`),
          React.createElement(
            Text,
            { style: styles.kpiBenchmark },
            `Benchmark: ${(benchmark.avg_ctr * 100).toFixed(2)}%`
          )
        )
      ),
      // Campaign Details
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'CAMPAIGN DETAILS'),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.rowLabel }, 'Idea'),
          React.createElement(Text, { style: styles.rowValue }, test.idea || test.name)
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.rowLabel }, 'Vertical'),
          React.createElement(Text, { style: styles.rowValue }, test.vertical || 'saas')
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.rowLabel }, 'Duration'),
          React.createElement(Text, { style: styles.rowValue }, '48 hours')
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.rowLabel }, 'Impressions'),
          React.createElement(
            Text,
            { style: styles.rowValue },
            metrics.impressions.toLocaleString()
          )
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.rowLabel }, 'Clicks'),
          React.createElement(Text, { style: styles.rowValue }, metrics.clicks.toLocaleString())
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.rowLabel }, 'LP Views'),
          React.createElement(Text, { style: styles.rowValue }, metrics.lp_views.toLocaleString())
        )
      ),
      // Verdict Logic Table
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'VERDICT LOGIC'),
        ...criteria.map((c, i) =>
          React.createElement(
            View,
            { key: i, style: styles.verdictRow },
            React.createElement(Text, { style: { flex: 2 } }, c.label),
            React.createElement(Text, { style: { flex: 1, textAlign: 'right' as const } }, c.actual),
            React.createElement(
              Text,
              { style: { flex: 1, textAlign: 'right' as const, color: colors.muted } },
              c.required
            ),
            React.createElement(
              Text,
              { style: { flex: 0.5, textAlign: 'right' as const, ...(c.pass ? styles.pass : styles.fail) } },
              c.pass ? '✓' : '✗'
            )
          )
        )
      ),
      // Footer
      React.createElement(
        Text,
        { style: styles.footer },
        `LaunchLense v0.1 • Generated ${new Date().toISOString().split('T')[0]} • ${test.id}`
      )
    )
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ test_id: string }> }
) {
  try {
    const { test_id } = await params;

    let test: TestData;
    let metrics: EventMetrics;
    let benchmark: Benchmark;

    // Fetch from Supabase
    const supabase = createServiceClient();

    const { data: testData, error: testError } = await supabase
      .from('tests')
      .select('*')
      .eq('id', test_id)
      .single();

    if (testError || !testData) {
      return Response.json({ error: 'Test not found' }, { status: 404 });
    }

    test = testData as TestData;

    // Aggregate metrics from events
    const { data: events } = await supabase
      .from('events')
      .select('payload')
      .eq('test_id', test_id)
      .eq('type', 'metrics');

    metrics = (events || []).reduce<EventMetrics>(
      (acc, e) => {
        const p = e.payload as Record<string, number>;
        return {
          spend_cents: acc.spend_cents + (p.spend_cents || 0),
          impressions: acc.impressions + (p.impressions || 0),
          clicks: acc.clicks + (p.clicks || 0),
          lp_views: acc.lp_views + (p.lp_views || 0),
          leads: acc.leads + (p.leads || 0),
        };
      },
      { spend_cents: 0, impressions: 0, clicks: 0, lp_views: 0, leads: 0 }
    );

    // Fetch benchmark for vertical
    const { data: bench } = await supabase
      .from('benchmarks')
      .select('*')
      .eq('vertical', test.vertical || 'saas')
      .single();

    benchmark = bench || { avg_ctr: 0.012, avg_cvr: 0.025, avg_cpa_cents: 4500 };

    // Render PDF
    const doc = VerdictPDF({ test, metrics, benchmark });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await renderToStream(doc as any);

    // Convert ReadableStream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err: Error) => controller.error(err));
      },
    });

    return new Response(webStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="launchlense-${test_id}.pdf"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[PDF] Generation failed:', error);
    return Response.json(
      { error: 'PDF generation failed', details: String(error) },
      { status: 500 }
    );
  }
}
