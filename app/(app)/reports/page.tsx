'use client';

import { useState, useEffect } from 'react';
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
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Report {
  id: string;
  test_name: string;
  verdict: string;
  created_at: string;
  stats: {
    spend_cents: number;
    impressions: number;
    clicks: number;
    lp_views: number;
    leads: number;
    ctr: number;
    cvr: number;
    cpa_cents: number;
  };
  benchmarks: {
    vertical: string;
    avg_cpa_cents: number;
    avg_cvr: number;
  };
}

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReports() {
      try {
        // Fetch completed tests that have verdicts
        const res = await fetch('/api/tests?status=completed');
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || []);
        }
      } catch (err) {
        console.error('Failed to fetch reports:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-[#A1A1A1] mt-1">Loading...</p>
        </div>
      </div>
    );
  }

  const report = reports[0]; // Show the latest report

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

      {report ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Verdict banner */}
          <Card className={`border-${report.verdict === 'GO' ? '[#22C55E]' : '[#EF4444]'}/20 mb-6`}>
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
                    style={{
                      border: `3px solid ${report.verdict === 'GO' ? '#22C55E' : '#EF4444'}`,
                      color: report.verdict === 'GO' ? '#22C55E' : '#EF4444',
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(`/api/reports/${report.id}`, '_blank');
                  }}
                >
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
                <span className="text-[#22C55E]">$35,000</span>{' '}
                <span className="text-base font-normal text-[#A1A1A1]">build</span>
              </div>
              <p className="text-sm text-[#A1A1A1] mt-2">
                ROI: {((35000 / (report.stats.spend_cents / 100 || 1)) * 100).toFixed(0)}% return on validation spend
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
                      {report.stats.cpa_cents < report.benchmarks.avg_cpa_cents * 0.8 ? (
                        <CheckCircle2 className="w-4 h-4 text-[#22C55E] mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#EF4444] mx-auto" />
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-[#262626]/50 h-10">
                    <td className="py-2 px-3">CVR</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {(report.stats.cvr * 100).toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">&gt; 2.00%</td>
                    <td className="py-2 px-3 text-center">
                      {report.stats.cvr > 0.02 ? (
                        <CheckCircle2 className="w-4 h-4 text-[#22C55E] mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#EF4444] mx-auto" />
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-[#262626]/50 h-10">
                    <td className="py-2 px-3">Min Leads</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {report.stats.leads}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">&gt; 5</td>
                    <td className="py-2 px-3 text-center">
                      {report.stats.leads > 5 ? (
                        <CheckCircle2 className="w-4 h-4 text-[#22C55E] mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#EF4444] mx-auto" />
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
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
