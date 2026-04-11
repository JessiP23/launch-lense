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
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);

  // Fetch test data and metrics from API
  useEffect(() => {
    async function fetchTest() {
      try {
        const res = await fetch(`/api/tests/${id}/metrics`);
        if (res.ok) {
          const data = await res.json();
          if (data.test) {
            setTestName(data.test.name || id);
            setCampaignId(data.test.campaign_id || null);
            setStatus(data.test.status || 'active');
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
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

        {/* Kill-Switch — top right */}
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
