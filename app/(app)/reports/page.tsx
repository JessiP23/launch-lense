'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  TrendingDown,
  DollarSign,
  Target,
  Users,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';

const demoReport = {
  id: 'report-demo-1',
  test_name: 'AI for Dentists',
  verdict: 'NO-GO' as string,
  created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  stats: {
    spend_cents: 48700,
    impressions: 12340,
    clicks: 148,
    lp_views: 126,
    leads: 2,
    ctr: 0.012,
    cvr: 0.0159,
    cpa_cents: 24350,
  },
  benchmarks: {
    vertical: 'saas',
    avg_cpa_cents: 4500,
    avg_cvr: 0.025,
  },
};

export default function ReportsPage() {
  const router = useRouter();
  const { isDemo } = useAppStore();

  const report = demoReport;
  const verdictColor = report.verdict === 'GO' ? '#22C55E' : '#EF4444';
  const savedAmount = 35000; // $35k theoretical MVP build cost

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-[#A1A1A1] mt-1">
            Go/No-Go verdicts for completed tests
          </p>
        </div>
      </div>

      {isDemo && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Verdict banner */}
          <Card className="border-[#EF4444]/20 mb-6">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
                    style={{
                      border: `3px solid ${verdictColor}`,
                      color: verdictColor,
                    }}
                  >
                    {report.verdict}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{report.test_name}</h2>
                    <p className="text-sm text-[#A1A1A1]">
                      Completed {new Date(report.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Savings callout */}
          <Card className="mb-6 bg-gradient-to-r from-[#171717] to-[#111111]">
            <CardContent className="pt-6 pb-6 text-center">
              <div className="text-3xl font-mono font-bold tabular-nums text-[#FAFAFA]">
                ${(report.stats.spend_cents / 100).toFixed(0)}{' '}
                <span className="text-base font-normal text-[#A1A1A1]">spent to avoid</span>{' '}
                <span className="text-[#22C55E]">${savedAmount.toLocaleString()}</span>{' '}
                <span className="text-base font-normal text-[#A1A1A1]">build</span>
              </div>
              <p className="text-sm text-[#A1A1A1] mt-2">
                ROI: {((savedAmount / (report.stats.spend_cents / 100)) * 100).toFixed(0)}% return on validation spend
              </p>
            </CardContent>
          </Card>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-[#A1A1A1] flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Total Spend
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
                <div className="text-[10px] text-[#A1A1A1]">
                  Benchmark: ${(report.benchmarks.avg_cpa_cents / 100).toFixed(0)}
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
                <div className="text-[10px] text-[#A1A1A1]">
                  Benchmark: {(report.benchmarks.avg_cvr * 100).toFixed(2)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Verdict logic */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Verdict Logic</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#262626]">
                    <th className="py-2 px-3 text-left text-[#A1A1A1] font-medium">Criterion</th>
                    <th className="py-2 px-3 text-right text-[#A1A1A1] font-medium">Actual</th>
                    <th className="py-2 px-3 text-right text-[#A1A1A1] font-medium">Required</th>
                    <th className="py-2 px-3 text-center text-[#A1A1A1] font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#262626]/50 h-10">
                    <td className="py-2 px-3">CPA vs Benchmark</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      ${(report.stats.cpa_cents / 100).toFixed(0)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      &lt; ${(report.benchmarks.avg_cpa_cents * 0.8 / 100).toFixed(0)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <XCircle className="w-4 h-4 text-[#EF4444] mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b border-[#262626]/50 h-10">
                    <td className="py-2 px-3">CVR</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {(report.stats.cvr * 100).toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">&gt; 2.00%</td>
                    <td className="py-2 px-3 text-center">
                      <XCircle className="w-4 h-4 text-[#EF4444] mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b border-[#262626]/50 h-10">
                    <td className="py-2 px-3">Min Leads</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {report.stats.leads}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">&gt; 5</td>
                    <td className="py-2 px-3 text-center">
                      <XCircle className="w-4 h-4 text-[#EF4444] mx-auto" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!isDemo && (
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <FileText className="w-12 h-12 mx-auto text-[#262626] mb-3" />
            <p className="text-[#A1A1A1]">No completed tests yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
