import { notFound } from 'next/navigation';
import { Shield, DollarSign, Users, Target, TrendingDown, XCircle, CheckCircle2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createServiceClient } from '@/lib/supabase';

// Fetch shared report from Supabase by share_token
async function getSharedReport(token: string) {
  const supabase = createServiceClient();

  const { data: test, error } = await supabase
    .from('tests')
    .select('id, name, verdict, created_at, vertical, budget_cents')
    .eq('share_token', token)
    .single();

  if (error || !test) return null;

  // Aggregate metrics from events
  const { data: events } = await supabase
    .from('events')
    .select('payload')
    .eq('test_id', test.id)
    .eq('type', 'metrics');

  const metrics = (events || []).reduce(
    (acc: Record<string, number>, e: { payload: unknown }) => {
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

  const ctr = metrics.impressions > 0 ? metrics.clicks / metrics.impressions : 0;
  const cvr = metrics.lp_views > 0 ? metrics.leads / metrics.lp_views : 0;
  const cpa_cents = metrics.leads > 0 ? Math.floor(metrics.spend_cents / metrics.leads) : 0;

  // Fetch benchmark
  const { data: bench } = await supabase
    .from('benchmarks')
    .select('*')
    .eq('vertical', test.vertical || 'saas')
    .single();

  return {
    test_name: test.name,
    verdict: test.verdict || 'PENDING',
    created_at: test.created_at,
    stats: {
      spend_cents: metrics.spend_cents,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      lp_views: metrics.lp_views,
      leads: metrics.leads,
      ctr,
      cvr,
      cpa_cents,
    },
    benchmarks: {
      vertical: test.vertical || 'saas',
      avg_cpa_cents: bench?.avg_cpa_cents || 4500,
      avg_cvr: bench?.avg_cvr || 0.025,
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getSharedReport(token);

  if (!report) {
    notFound();
  }

  const verdictColor = report.verdict === 'GO' ? '#22C55E' : '#EF4444';
  const savedAmount = 35000;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      {/* Minimal header */}
      <header className="flex items-center justify-between max-w-3xl mx-auto px-6 h-16 border-b border-[#262626]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#FAFAFA] flex items-center justify-center">
            <span className="text-[#0A0A0A] text-xs font-bold">LL</span>
          </div>
          <span className="font-semibold text-sm">LaunchLense Report</span>
        </div>
        <Badge variant="outline" className="text-xs">
          Shared Report • Read Only
        </Badge>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {/* Verdict */}
        <div className="text-center space-y-4">
          <div
            className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-2xl font-bold"
            style={{ border: `3px solid ${verdictColor}`, color: verdictColor }}
          >
            {report.verdict}
          </div>
          <h1 className="text-2xl font-semibold">{report.test_name}</h1>
          <p className="text-sm text-[#A1A1A1]">
            Completed {new Date(report.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Savings */}
        <Card className="bg-gradient-to-r from-[#171717] to-[#111111]">
          <CardContent className="pt-6 pb-6 text-center">
            <div className="text-2xl font-mono font-bold tabular-nums">
              ${(report.stats.spend_cents / 100).toFixed(0)} spent to avoid{' '}
              <span className="text-[#22C55E]">${savedAmount.toLocaleString()}</span> build
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-[#A1A1A1] flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Spend
              </div>
              <div className="text-xl font-mono font-bold tabular-nums mt-1">
                ${(report.stats.spend_cents / 100).toFixed(0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-[#A1A1A1] flex items-center gap-1">
                <Users className="w-3 h-3" /> Leads
              </div>
              <div className="text-xl font-mono font-bold tabular-nums mt-1">
                {report.stats.leads}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-[#A1A1A1] flex items-center gap-1">
                <Target className="w-3 h-3" /> CPA
              </div>
              <div className="text-xl font-mono font-bold tabular-nums mt-1 text-[#EF4444]">
                ${(report.stats.cpa_cents / 100).toFixed(0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-[#A1A1A1] flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> CVR
              </div>
              <div className="text-xl font-mono font-bold tabular-nums mt-1 text-[#EF4444]">
                {(report.stats.cvr * 100).toFixed(2)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Verdict criteria */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Verdict Criteria</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#262626]">
                  <th className="py-2 text-left text-[#A1A1A1] font-medium">Check</th>
                  <th className="py-2 text-right text-[#A1A1A1] font-medium">Actual</th>
                  <th className="py-2 text-right text-[#A1A1A1] font-medium">Required</th>
                  <th className="py-2 text-center text-[#A1A1A1] font-medium">Pass</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#262626]/50 h-10">
                  <td className="py-2">CPA vs Benchmark</td>
                  <td className="py-2 text-right font-mono tabular-nums">${(report.stats.cpa_cents / 100).toFixed(0)}</td>
                  <td className="py-2 text-right font-mono tabular-nums">&lt; ${(report.benchmarks.avg_cpa_cents * 0.8 / 100).toFixed(0)}</td>
                  <td className="py-2 text-center">
                    {report.stats.cpa_cents < report.benchmarks.avg_cpa_cents * 0.8
                      ? <CheckCircle2 className="w-4 h-4 text-[#22C55E] mx-auto" />
                      : <XCircle className="w-4 h-4 text-[#EF4444] mx-auto" />}
                  </td>
                </tr>
                <tr className="border-b border-[#262626]/50 h-10">
                  <td className="py-2">CVR</td>
                  <td className="py-2 text-right font-mono tabular-nums">{(report.stats.cvr * 100).toFixed(2)}%</td>
                  <td className="py-2 text-right font-mono tabular-nums">&gt; 2.00%</td>
                  <td className="py-2 text-center">
                    {report.stats.cvr > 0.02
                      ? <CheckCircle2 className="w-4 h-4 text-[#22C55E] mx-auto" />
                      : <XCircle className="w-4 h-4 text-[#EF4444] mx-auto" />}
                  </td>
                </tr>
                <tr className="border-b border-[#262626]/50 h-10">
                  <td className="py-2">Leads</td>
                  <td className="py-2 text-right font-mono tabular-nums">{report.stats.leads}</td>
                  <td className="py-2 text-right font-mono tabular-nums">&gt; 5</td>
                  <td className="py-2 text-center">
                    {report.stats.leads > 5
                      ? <CheckCircle2 className="w-4 h-4 text-[#22C55E] mx-auto" />
                      : <XCircle className="w-4 h-4 text-[#EF4444] mx-auto" />}
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-[#A1A1A1] pt-6 border-t border-[#262626]">
          Generated by LaunchLense v0.1 • Ad Account Insurance for Venture Studios
        </div>
      </main>
    </div>
  );
}
