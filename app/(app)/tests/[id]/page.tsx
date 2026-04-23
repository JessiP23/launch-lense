'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { HealthgateRing } from '@/components/healthgate-ring';
import { StatusDot } from '@/components/status-dot';
import { useAppStore } from '@/lib/store';
import { pauseTest } from './actions';

interface Metrics {
  impressions: number;
  clicks: number;
  spend_cents: number;
  lp_views: number;
  leads: number;
  ctr: number;
  cpa_cents: number;
}

export default function TestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { healthSnapshot } = useAppStore();

  const [testName, setTestName] = useState<string>(id);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [adAccountId, setAdAccountId] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [status, setStatus] = useState<'active' | 'paused' | 'completed'>('active');
  const [metrics, setMetrics] = useState<Metrics>({
    impressions: 0,
    clicks: 0,
    spend_cents: 0,
    lp_views: 0,
    leads: 0,
    ctr: 0,
    cpa_cents: 0,
  });
  const [metricsHistory, setMetricsHistory] = useState<Metrics[]>([]);
  const [annotations, setAnnotations] = useState<{ created_at: string; message: string }[]>([]);
  const [lpUrl, setLpUrl] = useState<string | null>(null);
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);
  const [forcingGo, setForcingGo] = useState(false);

  useEffect(() => {
    async function fetchTest() {
      try {
        const res = await fetch(`/api/tests/${id}/metrics`);
        if (res.ok) {
          const data = await res.json();
          if (data.test) {
            setTestName(data.test.name || id);
            setCampaignId(data.test.campaign_id || null);
            setAdAccountId(data.test.ad_account_id || null);
            setStatus(data.test.status || 'active');
            setVerdict(data.test.verdict || null);
            setLpUrl(data.test.lp_url || null);
          }
          if (data.metrics) {
            setMetrics(data.metrics);
            setMetricsHistory((prev) => [...prev.slice(-20), data.metrics]);
          }
          if (data.annotations) {
            setAnnotations(data.annotations);
          }
        }
      } catch (err) {
        console.error('Failed to fetch test data:', err);
      }
    }

    fetchTest();
    // Poll every 30s for live tests
    const interval = setInterval(() => {
      if (status === 'active') fetchTest();
    }, 30000);
    return () => clearInterval(interval);
  }, [id, status]);

  const handleKillSwitch = async () => {
    setKillSwitchLoading(true);
    try {
      const result = await pauseTest({
        testId: id,
        reason: 'Kill-Switch activated by user',
      });
      if (result.success) {
        setStatus('paused');
      } else {
        console.error('Kill-Switch failed:', result.error);
      }
    } catch (err) {
      console.error('Kill-Switch error:', err);
    } finally {
      setKillSwitchLoading(false);
    }
  };

  // Force GO verdict (dev only)
  const handleForceGo = async () => {
    setForcingGo(true);
    try {
      const res = await fetch('/api/force-go', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_id: id }),
      });
      if (res.ok) {
        // Wait a beat then re-fetch
        await new Promise((r) => setTimeout(r, 1500));
        const metricsRes = await fetch(`/api/tests/${id}/metrics`);
        if (metricsRes.ok) {
          const data = await metricsRes.json();
          if (data.test) {
            setStatus(data.test.status || 'active');
            setVerdict(data.test.verdict || null);
          }
          if (data.metrics) setMetrics(data.metrics);
          if (data.annotations) setAnnotations(data.annotations);
        }
      } else {
        const err = await res.json();
        console.error('Force GO failed:', err.error);
      }
    } catch (err) {
      console.error('Force GO error:', err);
    } finally {
      setForcingGo(false);
    }
  };

  const kpiCards = [
    { label: 'Spend',       value: metrics.spend_cents,  fmt: (v: number) => `$${(v / 100).toFixed(0)}`,        accent: false },
    { label: 'Impressions', value: metrics.impressions,  fmt: (v: number) => v.toLocaleString(),                accent: false },
    { label: 'CTR',         value: metrics.ctr,          fmt: (v: number) => `${(v * 100).toFixed(2)}%`,        accent: metrics.ctr > 0.01 },
    { label: 'LP Views',    value: metrics.lp_views,     fmt: (v: number) => v.toLocaleString(),                accent: false },
    { label: 'Leads',       value: metrics.leads,        fmt: (v: number) => v.toString(),                      accent: metrics.leads > 0 },
    { label: 'CPA',         value: metrics.cpa_cents,    fmt: (v: number) => v > 0 ? `$${(v / 100).toFixed(0)}` : '—', accent: false },
  ];

  const isAnomaly = metrics.cpa_cents > 9000 && metrics.spend_cents > 5000;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[0.8125rem] text-[#8C8880]">
        <button
          onClick={() => router.push('/tests')}
          className="hover:text-[#111110] transition-colors"
        >
          ← All Tests
        </button>
        <span>/</span>
        <span className="text-[#111110] font-medium truncate max-w-xs">{testName}</span>
      </div>

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {healthSnapshot && (
            <HealthgateRing
              score={healthSnapshot.score}
              status={healthSnapshot.status}
              checks={healthSnapshot.checks}
              size={40}
            />
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-[1.375rem] font-bold tracking-[-0.02em] text-[#111110]">
                {testName}
              </h1>
              {status === 'active' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[0.6875rem] font-medium">
                  <StatusDot status="green" pulse />
                  Live
                </span>
              )}
              {status === 'paused' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] text-[0.6875rem] font-medium">
                  Paused
                </span>
              )}
            </div>
            {campaignId && (
              <p className="text-[0.75rem] text-[#8C8880] mt-0.5 font-mono">
                Campaign {campaignId}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {(status === 'active' || (status === 'completed' && verdict === 'GO')) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/editor/${id}`)}
              className="border-[#E8E4DC] text-[#111110] hover:bg-[#F3F0EB]"
            >
              {status === 'completed' ? 'Build Full Landing Page' : 'Edit Landing Page'}
            </Button>
          )}

          {status === 'active' && process.env.NODE_ENV === 'development' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleForceGo}
              disabled={forcingGo}
              className="border-[#E8E4DC] text-[#8C8880] hover:bg-[#F3F0EB]"
            >
              {forcingGo && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {forcingGo ? 'Forcing…' : 'Force GO'}
            </Button>
          )}

          {status === 'active' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-[#DC2626] text-white hover:bg-[#DC2626]/90 border-0"
                >
                  Kill-Switch
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white border-[#E8E4DC]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-[#111110]">Activate Kill-Switch?</AlertDialogTitle>
                  <AlertDialogDescription className="text-[#8C8880]">
                    This will immediately pause the campaign on Meta. The ad will stop receiving traffic. This action is logged in the audit trail.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-[#E8E4DC] text-[#111110]">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleKillSwitch}
                    className="bg-[#DC2626] text-white hover:bg-[#DC2626]/90"
                  >
                    Confirm Pause
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Anomaly alert */}
      {isAnomaly && status === 'active' && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-[#DC2626]/20 bg-[#FEF2F2]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-[#DC2626] text-[0.9375rem]">Anomaly Detected</p>
              <p className="text-[0.8125rem] text-[#8C8880] mt-0.5">
                CPA is 2× above target. Consider pausing to preserve budget.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-[#DC2626] text-white hover:bg-[#DC2626]/90 border-0"
              onClick={handleKillSwitch}
            >
              Pause Now
            </Button>
          </div>
        </motion.div>
      )}

      {/* Paused banner */}
      {status === 'paused' && !verdict && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-[#D97706]/20 bg-[#FFFBEB]"
        >
          <p className="font-semibold text-[#D97706] text-[0.9375rem]">Campaign Paused</p>
          <p className="text-[0.8125rem] text-[#8C8880] mt-0.5">
            Kill-Switch activated. Campaign is no longer receiving traffic.
          </p>
        </motion.div>
      )}

      {/* Verdict banner */}
      {verdict && (status === 'completed' || status === 'paused') && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-5 rounded-xl border ${
            verdict === 'GO'
              ? 'border-[#059669]/20 bg-[#ECFDF5]'
              : verdict === 'NO-GO'
              ? 'border-[#DC2626]/20 bg-[#FEF2F2]'
              : 'border-[#D97706]/20 bg-[#FFFBEB]'
          }`}
        >
          <p className={`font-display text-[1.5rem] font-bold tracking-[-0.02em] ${
            verdict === 'GO' ? 'text-[#059669]' : verdict === 'NO-GO' ? 'text-[#DC2626]' : 'text-[#D97706]'
          }`}>
            Verdict: {verdict}
          </p>
          <p className="text-[0.875rem] text-[#8C8880] mt-2">
            {verdict === 'GO'
              ? `$${(metrics.spend_cents / 100).toFixed(0)} spent to validate — this idea has demand. Time to build.`
              : verdict === 'NO-GO'
              ? `$${(metrics.spend_cents / 100).toFixed(0)} spent to kill the idea early — saved ~$35k on a bad MVP.`
              : 'Insufficient data for a conclusive verdict. Consider extending the test.'}
          </p>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {verdict === 'GO' && (
              <Button
                size="sm"
                className="bg-[#059669] text-white hover:bg-[#059669]/90 border-0 font-semibold"
                onClick={() => router.push(`/editor/${id}`)}
              >
                Build Full Landing Page
              </Button>
            )}
            {lpUrl && (
              <Button
                variant="outline"
                size="sm"
                className="border-[#E8E4DC] text-[#111110] hover:bg-[#F3F0EB]"
                onClick={() => window.open(lpUrl, '_blank')}
              >
                Preview Current LP
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="border-[#E8E4DC] text-[#111110] hover:bg-[#F3F0EB]"
              onClick={() => window.open(`/api/reports/${id}`, '_blank')}
            >
              Download PDF Report
            </Button>
          </div>
        </motion.div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl border border-[#E8E4DC] px-4 pt-4 pb-3"
          >
            <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-1">
              {kpi.label}
            </p>
            <p
              className="text-[1.625rem] font-mono font-bold tabular-nums"
              style={{ color: kpi.accent ? '#059669' : '#111110' }}
            >
              {kpi.fmt(kpi.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Sparklines */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white rounded-xl border border-[#E8E4DC] p-4">
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-3">
            Spend Over Time
          </p>
          <div className="flex items-end gap-1 h-16">
            {metricsHistory.map((m, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (m.spend_cents / 50000) * 100)}%` }}
                className="flex-1 rounded-sm bg-[#111110]/10"
                style={{ minHeight: 4 }}
              />
            ))}
            {metricsHistory.length === 0 && (
              <p className="flex-1 text-center text-[0.75rem] text-[#8C8880] self-center">
                Waiting for data…
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E8E4DC] p-4">
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-3">
            Leads Over Time
          </p>
          <div className="flex items-end gap-1 h-16">
            {metricsHistory.map((m, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (m.leads / 20) * 100)}%` }}
                className="flex-1 rounded-sm bg-[#059669]/20"
                style={{ minHeight: 4 }}
              />
            ))}
            {metricsHistory.length === 0 && (
              <p className="flex-1 text-center text-[0.75rem] text-[#8C8880] self-center">
                Waiting for data…
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Audit log */}
      <div className="bg-white rounded-xl border border-[#E8E4DC] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E8E4DC]">
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880]">
            Audit Log
          </p>
        </div>
        <table className="w-full text-[0.875rem]">
          <tbody>
            {annotations.length > 0 ? (
              annotations.map((a, i) => (
                <tr key={i} className={i < annotations.length - 1 ? 'border-b border-[#E8E4DC]' : ''}>
                  <td className="py-2.5 px-4 text-[#8C8880] text-[0.75rem] font-mono w-48 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 text-[#111110]">{a.message}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-2.5 px-4 text-[#8C8880] text-[0.75rem] font-mono w-48 whitespace-nowrap">
                  {new Date().toLocaleString()}
                </td>
                <td className="py-2.5 px-4 text-[#8C8880]">Test loaded</td>
              </tr>
            )}
            {status === 'paused' && (
              <tr className="border-t border-[#E8E4DC]">
                <td className="py-2.5 px-4 text-[#8C8880] text-[0.75rem] font-mono whitespace-nowrap">
                  {new Date().toLocaleString()}
                </td>
                <td className="py-2.5 px-4 text-[#DC2626] text-[0.875rem]">
                  Kill-Switch activated — Campaign paused
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
