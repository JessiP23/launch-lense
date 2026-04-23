'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2 } from 'lucide-react';

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
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tests?status=completed')
      .then((r) => r.ok ? r.json() : { reports: [] })
      .then((d) => setReports(d.reports || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-5 h-5 animate-spin text-[#8C8880]" />
      </div>
    );
  }

  const report = reports[0];

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[#8C8880]">Reports</p>
        <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.03em] text-[#111110] mt-0.5">
          Go / No-Go Verdicts
        </h1>
        <p className="text-[0.9375rem] text-[#8C8880] mt-1">Results for completed tests.</p>
      </div>

      {report ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Verdict banner */}
          <div className={`flex items-center justify-between p-5 rounded-xl border ${
            report.verdict === 'GO'
              ? 'border-[#059669]/20 bg-[#ECFDF5]'
              : 'border-[#DC2626]/20 bg-[#FEF2F2]'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center font-display font-bold tracking-tight ${
                report.verdict === 'GO' ? 'border-[#059669] text-[#059669]' : 'border-[#DC2626] text-[#DC2626]'
              }`}>
                {report.verdict}
              </div>
              <div>
                <p className="font-display font-bold text-[1.125rem] tracking-[-0.01em] text-[#111110]">
                  {report.test_name}
                </p>
                <p className="text-[0.8125rem] text-[#8C8880] mt-0.5">
                  Completed {new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
            <button
              onClick={() => window.open(`/api/reports/${report.id}`, '_blank')}
              className="text-[0.8125rem] font-medium text-[#8C8880] hover:text-[#111110] border border-[#E8E4DC] px-3 py-1.5 rounded-full bg-white hover:bg-[#F3F0EB] transition-colors"
            >
              Export PDF
            </button>
          </div>

          {/* Savings callout */}
          <div className="bg-white rounded-xl border border-[#E8E4DC] p-5 text-center">
            <p className="font-mono tabular-nums text-[1.5rem] font-bold text-[#111110]">
              ${(report.stats.spend_cents / 100).toFixed(0)}{' '}
              <span className="text-[0.9375rem] font-normal text-[#8C8880]">spent to avoid</span>{' '}
              <span className="text-[#059669]">$35,000</span>{' '}
              <span className="text-[0.9375rem] font-normal text-[#8C8880]">build</span>
            </p>
            <p className="text-[0.8125rem] text-[#8C8880] mt-1.5">
              {((35000 / (report.stats.spend_cents / 100 || 1)) * 100).toFixed(0)}× return on validation spend
            </p>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Spend', value: `$${(report.stats.spend_cents / 100).toFixed(0)}`, warn: false, sub: null },
              { label: 'Leads', value: String(report.stats.leads), warn: false, sub: null },
              {
                label: 'CPA',
                value: `$${(report.stats.cpa_cents / 100).toFixed(0)}`,
                sub: `Benchmark $${(report.benchmarks.avg_cpa_cents / 100).toFixed(0)}`,
                warn: report.stats.cpa_cents >= report.benchmarks.avg_cpa_cents * 0.8,
              },
              {
                label: 'CVR',
                value: `${(report.stats.cvr * 100).toFixed(2)}%`,
                sub: `Benchmark ${(report.benchmarks.avg_cvr * 100).toFixed(2)}%`,
                warn: report.stats.cvr <= 0.02,
              },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl border border-[#E8E4DC] px-4 py-3">
                <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880]">{kpi.label}</p>
                <p className={`font-mono tabular-nums text-[1.25rem] font-bold mt-1 ${kpi.warn ? 'text-[#DC2626]' : 'text-[#111110]'}`}>
                  {kpi.value}
                </p>
                {kpi.sub && <p className="text-[0.6875rem] text-[#8C8880] mt-0.5">{kpi.sub}</p>}
              </div>
            ))}
          </div>

          {/* Verdict logic table */}
          <div className="bg-white rounded-xl border border-[#E8E4DC] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E8E4DC]">
              <p className="font-display font-bold text-[0.9375rem] tracking-[-0.01em] text-[#111110]">Verdict Logic</p>
            </div>
            <table className="w-full text-[0.875rem]">
              <thead>
                <tr className="border-b border-[#E8E4DC] bg-[#FAFAF8]">
                  {['Criterion', 'Actual', 'Required', 'Pass'].map((h, i) => (
                    <th key={h} className={`py-2.5 px-5 text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] ${i === 0 ? 'text-left' : i === 3 ? 'text-center' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: 'CPA vs Benchmark',
                    actual: `$${(report.stats.cpa_cents / 100).toFixed(0)}`,
                    required: `< $${(report.benchmarks.avg_cpa_cents * 0.8 / 100).toFixed(0)}`,
                    pass: report.stats.cpa_cents < report.benchmarks.avg_cpa_cents * 0.8,
                  },
                  {
                    label: 'CVR',
                    actual: `${(report.stats.cvr * 100).toFixed(2)}%`,
                    required: '> 2.00%',
                    pass: report.stats.cvr > 0.02,
                  },
                  {
                    label: 'Min Leads',
                    actual: String(report.stats.leads),
                    required: '> 5',
                    pass: report.stats.leads > 5,
                  },
                ].map((row, i, arr) => (
                  <tr key={row.label} className={i < arr.length - 1 ? 'border-b border-[#E8E4DC]' : ''}>
                    <td className="py-3 px-5 text-[#111110]">{row.label}</td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums text-[#111110]">{row.actual}</td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums text-[#8C8880]">{row.required}</td>
                    <td className="py-3 px-5 text-center">
                      {row.pass
                        ? <CheckCircle2 className="w-4 h-4 text-[#059669] mx-auto" />
                        : <span className="text-[#DC2626] font-bold text-base leading-none">✗</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E8E4DC] p-10 text-center">
          <p className="font-display font-bold text-[1.0625rem] text-[#111110]">No completed tests yet</p>
          <p className="text-[0.875rem] text-[#8C8880] mt-1.5">
            Reports appear here once a test reaches a Go / No-Go verdict.
          </p>
        </div>
      )}
    </div>
  );
}
