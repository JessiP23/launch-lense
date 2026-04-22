'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Shield,
  Zap,
  ArrowLeft,
  OctagonX,
  TrendingUp,
  Eye,
  MousePointerClick,
  DollarSign,
  Users,
  Target,
  Loader2,
  PenLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { pauseTest, duplicateAd } from './actions';

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
    {
      label: 'Spend',
      value: metrics.spend_cents,
      format: (v: number) => `$${(v / 100).toFixed(0)}`,
      icon: DollarSign,
      color: '#FAFAFA',
    },
    {
      label: 'Impressions',
      value: metrics.impressions,
      format: (v: number) => v.toLocaleString(),
      icon: Eye,
      color: '#FAFAFA',
    },
    {
      label: 'CTR',
      value: metrics.ctr,
      format: (v: number) => `${(v * 100).toFixed(2)}%`,
      icon: MousePointerClick,
      color: metrics.ctr > 0.01 ? '#22C55E' : '#EAB308',
    },
    {
      label: 'LP Views',
      value: metrics.lp_views,
      format: (v: number) => v.toLocaleString(),
      icon: TrendingUp,
      color: '#FAFAFA',
    },
    {
      label: 'Leads',
      value: metrics.leads,
      format: (v: number) => v.toString(),
      icon: Users,
      color: metrics.leads > 0 ? '#22C55E' : '#A1A1A1',
    },
    {
      label: 'CPA',
      value: metrics.cpa_cents,
      format: (v: number) => v > 0 ? `$${(v / 100).toFixed(0)}` : '—',
      icon: Target,
      color: metrics.cpa_cents > 0 && metrics.cpa_cents < 5000 ? '#22C55E' : metrics.cpa_cents > 6000 ? '#EF4444' : '#FAFAFA',
    },
  ];

  // Anomaly detection
  const isAnomaly = metrics.cpa_cents > 9000 && metrics.spend_cents > 5000;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-[#A1A1A1]">
        <button
          onClick={() => router.push('/tests')}
          className="hover:text-[#FAFAFA] transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Tests
        </button>
        <span>/</span>
        <span className="text-[#FAFAFA] font-medium truncate max-w-xs">{testName}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {healthSnapshot && (
            <HealthgateRing
              score={healthSnapshot.score}
              status={healthSnapshot.status}
              checks={healthSnapshot.checks}
              size={40}
            />
          )}
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              Test: {testName}
              {status === 'active' && (
                <Badge variant="success" className="ml-2">
                  <StatusDot status="green" pulse className="mr-1.5" />
                  Live
                </Badge>
              )}
              {status === 'paused' && (
                <Badge variant="warning" className="ml-2">Paused</Badge>
              )}
            </h1>
            {campaignId && (
              <p className="text-xs text-[#A1A1A1] mt-0.5">
                Campaign ID: {campaignId}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons — top right */}
        <div className="flex items-center gap-2">
         
          {(status === 'active' || (status === 'completed' && verdict === 'GO')) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/editor/${id}`)}
            >
              <PenLine className="w-4 h-4 mr-1.5" />
              {status === 'completed' ? 'Build Full Landing Page' : 'Edit Landing Page'}
            </Button>
          )}

          {/* Force GO — dev only */}
          {status === 'active' && process.env.NODE_ENV === 'development' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleForceGo}
              disabled={forcingGo}
            >
              {forcingGo ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-1.5 text-[#22C55E]" />
              )}
              {forcingGo ? 'Forcing…' : 'Force GO Verdict'}
            </Button>
          )}

          {/* Kill-Switch */}
          {status === 'active' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <OctagonX className="w-4 h-4 mr-2" />
                  Kill-Switch
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <OctagonX className="w-5 h-5 text-[#EF4444]" />
                    Activate Kill-Switch?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will immediately pause the campaign on Meta. The ad will stop receiving traffic. This action is logged in the audit trail.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleKillSwitch}
                    className="bg-[#EF4444] text-[#FAFAFA] hover:bg-[#EF4444]/90"
                  >
                    Confirm Pause
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Anomaly Alert */}
      {isAnomaly && status === 'active' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/5"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[#EF4444] font-semibold">
                <Zap className="w-4 h-4" />
                Anomaly Detected
              </div>
              <p className="text-sm text-[#A1A1A1] mt-1">
                CPA is 2x+ above target. Consider pausing to preserve budget.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleKillSwitch}>
              Pause Now
            </Button>
          </div>
        </motion.div>
      )}

      {/* Paused banner */}
      {status === 'paused' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg border border-[#EAB308]/30 bg-[#EAB308]/5"
        >
          <div className="flex items-center gap-2 text-[#EAB308] font-semibold">
            <OctagonX className="w-4 h-4" />
            Campaign Paused
          </div>
          <p className="text-sm text-[#A1A1A1] mt-1">
            Kill-Switch activated. Campaign is no longer receiving traffic.
          </p>
        </motion.div>
      )}

      {/* Verdict banner — shown at top so it's immediately visible */}
      {verdict && (status === 'completed' || status === 'paused') && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-5 rounded-lg border ${
            verdict === 'GO'
              ? 'border-[#22C55E]/30 bg-[#22C55E]/5'
              : verdict === 'NO-GO'
              ? 'border-[#EF4444]/30 bg-[#EF4444]/5'
              : 'border-[#EAB308]/30 bg-[#EAB308]/5'
          }`}
        >
          <div className={`flex items-center gap-2 font-bold text-xl ${
            verdict === 'GO' ? 'text-[#22C55E]' : verdict === 'NO-GO' ? 'text-[#EF4444]' : 'text-[#EAB308]'
          }`}>
            <Shield className="w-6 h-6" />
            Verdict: {verdict}
          </div>
          <p className="text-sm text-[#A1A1A1] mt-2">
            {verdict === 'GO'
              ? `$${(metrics.spend_cents / 100).toFixed(0)} spent to validate — this idea has demand. Time to build.`
              : verdict === 'NO-GO'
              ? `$${(metrics.spend_cents / 100).toFixed(0)} spent to kill the idea early — saved ~$35k on a bad MVP.`
              : 'Insufficient data for conclusive verdict. Consider extending the test.'}
          </p>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {verdict === 'GO' && (
              <Button
                size="sm"
                className="bg-[#22C55E] text-black hover:bg-[#22C55E]/90 font-semibold"
                onClick={() => router.push(`/editor/${id}`)}
              >
                <Zap className="w-4 h-4 mr-1.5" />
                Build Full Landing Page
              </Button>
            )}
            {lpUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(lpUrl, '_blank')}
              >
                <Eye className="w-4 h-4 mr-1.5" />
                Preview Current LP
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/reports/${id}`, '_blank')}
            >
              Download PDF Report
            </Button>
          </div>
        </motion.div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-1.5 text-[#A1A1A1] mb-1">
                <kpi.icon className="w-3.5 h-3.5" />
                <span className="text-xs">{kpi.label}</span>
              </div>
              <div
                className="text-2xl font-mono font-bold tabular-nums"
                style={{ color: kpi.color }}
              >
                {kpi.format(kpi.value)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Metrics history mini-sparklines */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Spend Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-20">
              {metricsHistory.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{
                    height: `${Math.max(4, (m.spend_cents / 50000) * 100)}%`,
                  }}
                  className="flex-1 rounded-sm bg-[#FAFAFA]/20"
                  style={{
                    minHeight: 4,
                  }}
                />
              ))}
              {metricsHistory.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-xs text-[#A1A1A1]">
                  Waiting for data...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Leads Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-20">
              {metricsHistory.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{
                    height: `${Math.max(4, (m.leads / 20) * 100)}%`,
                  }}
                  className="flex-1 rounded-sm bg-[#22C55E]/30"
                  style={{ minHeight: 4 }}
                />
              ))}
              {metricsHistory.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-xs text-[#A1A1A1]">
                  Waiting for data...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {annotations.length > 0 ? (
                annotations.map((a, i) => (
                  <tr key={i} className="border-b border-[#262626]/50 h-10">
                    <td className="py-2 text-[#A1A1A1] text-xs w-40">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                    <td className="py-2">{a.message}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-[#262626]/50 h-10">
                  <td className="py-2 text-[#A1A1A1] text-xs w-40">
                    {new Date().toLocaleString()}
                  </td>
                  <td className="py-2">Test loaded</td>
                </tr>
              )}
              {status === 'paused' && (
                <tr className="border-b border-[#262626]/50 h-10">
                  <td className="py-2 text-[#A1A1A1] text-xs">
                    {new Date().toLocaleString()}
                  </td>
                  <td className="py-2 text-[#EF4444]">
                    Kill-Switch activated — Campaign paused
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

    </div>
  );
}
