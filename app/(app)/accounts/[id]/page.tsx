'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, RefreshCw, ArrowLeft, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HealthgateRing } from '@/components/healthgate-ring';
import { StatusDot } from '@/components/status-dot';
import { useAppStore } from '@/lib/store';
import type { HealthCheck, HealthSnapshot } from '@/lib/healthgate';

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;
  const { healthSnapshot, canLaunch, setHealthSnapshot, setActiveAccountId } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [dataFormat, setDataFormat] = useState<string[] | null>(null);

  // Fetch health on mount if we don't have a snapshot, or always refresh
  useEffect(() => {
    if (accountId) {
      setActiveAccountId(accountId);
      fetchHealth();
    }
  }, [accountId]);

  const fetchHealth = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/health/sync?account_id=${encodeURIComponent(accountId)}`);
      const data = await res.json();

      if (res.status >= 500) {
        setApiError(data.error || 'Unknown server error');
        return;
      }

      if (res.status === 404) {
        setApiError(`Account ${accountId} not found. Connect it first.`);
        return;
      }

      if (!res.ok) {
        setApiError(data.error || `HTTP ${res.status}`);
        return;
      }

      if (data.snapshot) {
        setHealthSnapshot(data.snapshot);
        setDataFormat(data.data_format || null);
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // ── Error state: show Meta API error with re-auth option ─────────────
  if (apiError) {
    const isAuthError = apiError.includes('190') || apiError.includes('OAuth') || apiError.includes('token');
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-semibold">Account Health</h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/5"
        >
          <div className="flex items-center gap-2 font-semibold text-[#EF4444] mb-2">
            <AlertTriangle className="w-5 h-5" />
            Meta API Error
          </div>
          <p className="text-sm text-[#A1A1A1] mb-4 font-mono break-all">
            {apiError}
          </p>
          <div className="flex gap-3">
            {isAuthError && (
              <Button
                onClick={() => { window.location.href = '/api/auth/meta/start'; }}
                size="sm"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Re-authenticate with Meta
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Retry
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/accounts/connect')}>
              Back to Connect
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────
  if (loading && !healthSnapshot) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="w-10 h-10 text-[#A1A1A1] animate-spin" />
        <p className="text-[#A1A1A1] text-sm">Fetching account health from Meta…</p>
      </div>
    );
  }

  // ── No data state ────────────────────────────────────────────────────
  if (!healthSnapshot) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Shield className="w-16 h-16 text-[#262626]" />
        <p className="text-[#A1A1A1]">No health data. Connect an account first.</p>
        <Button onClick={() => router.push('/accounts/connect')}>
          Connect Account
        </Button>
      </div>
    );
  }

  // ── Main view ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Account Health</h1>
          <p className="text-sm text-[#A1A1A1] mt-0.5">
            ID: {accountId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <HealthgateRing
            score={healthSnapshot.score}
            status={healthSnapshot.status}
            checks={healthSnapshot.checks}
            size={64}
          />
        </div>
      </div>

      {/* Status banner */}
      {healthSnapshot.status === 'red' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/5"
        >
          <div className="flex items-center gap-2 font-semibold text-[#EF4444]">
            <Shield className="w-5 h-5" />
            Launch Blocked — Score {healthSnapshot.score}/100
          </div>
          <p className="text-sm text-[#A1A1A1] mt-1">
            Health score must be 60+ to create tests. Fix the failing checks below.
          </p>
        </motion.div>
      )}
      {healthSnapshot.status === 'yellow' && (
        <div className="p-4 rounded-lg border border-[#EAB308]/20 bg-[#EAB308]/5">
          <div className="flex items-center gap-2 font-semibold text-[#EAB308]">
            <Shield className="w-5 h-5" />
            Review Recommended — Score {healthSnapshot.score}/100
          </div>
          <p className="text-sm text-[#A1A1A1] mt-1">
            You can launch, but some checks need attention for optimal results.
          </p>
        </div>
      )}
      {healthSnapshot.status === 'green' && (
        <div className="p-4 rounded-lg border border-[#22C55E]/20 bg-[#22C55E]/5">
          <div className="flex items-center gap-2 font-semibold text-[#22C55E]">
            <Shield className="w-5 h-5" />
            Launch Ready — Score {healthSnapshot.score}/100
          </div>
          <p className="text-sm text-[#A1A1A1] mt-1">
            All systems go. You can create and deploy validation tests.
          </p>
        </div>
      )}

      {/* 12 checks table */}
      <Card>
        <CardHeader>
          <CardTitle>Healthgate™ 12-Point Inspection</CardTitle>
          {dataFormat && (
            <CardDescription className="font-mono text-xs">
              Meta returned: {dataFormat.join(', ')}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#262626]">
                <th className="py-2 px-3 text-left text-[#A1A1A1] font-medium w-8">Status</th>
                <th className="py-2 px-3 text-left text-[#A1A1A1] font-medium">Check</th>
                <th className="py-2 px-3 text-left text-[#A1A1A1] font-medium">Value</th>
                <th className="py-2 px-3 text-right text-[#A1A1A1] font-medium tabular-nums">Points</th>
                <th className="py-2 px-3 text-left text-[#A1A1A1] font-medium">Fix</th>
              </tr>
            </thead>
            <tbody>
              {healthSnapshot.checks.map((check: HealthCheck) => {
                const isSandboxAssumed =
                  typeof check.value === 'string' && check.value.includes('sandbox');

                return (
                  <tr
                    key={check.key}
                    className="border-b border-[#262626]/50 h-10 hover:bg-[#111111] transition-colors"
                  >
                    <td className="py-2 px-3">
                      <StatusDot status={check.passed ? 'green' : 'red'} />
                    </td>
                    <td className="py-2 px-3 font-medium">{check.name}</td>
                    <td className="py-2 px-3 text-[#A1A1A1] font-mono tabular-nums">
                      <span title={isSandboxAssumed ? 'Assumed pass in Sandbox — cannot verify via API' : undefined}>
                        {check.value}
                        {isSandboxAssumed && (
                          <span className="ml-1.5 text-[10px] text-[#EAB308] cursor-help" title="Assumed pass in Sandbox">
                            ⓘ
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      <span className={check.passed ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                        {check.points}
                      </span>
                      <span className="text-[#A1A1A1]">/{check.maxPoints}</span>
                    </td>
                    <td className="py-2 px-3 text-xs text-[#A1A1A1] max-w-[240px]">
                      {!check.passed && check.fix}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="py-3 px-3 font-semibold text-base">
                  Total Score
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold tabular-nums text-2xl">
                  {healthSnapshot.score}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={() => router.push('/tests/new')}
          disabled={!canLaunch}
        >
          {canLaunch ? 'Create New Test' : 'New Test (Blocked)'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/accounts/connect')}>
          Back to Connect
        </Button>
      </div>
    </div>
  );
}
