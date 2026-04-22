'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, RefreshCw, ArrowLeft, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { HealthgateRing } from '@/components/healthgate-ring';
import { StatusDot } from '@/components/status-dot';
import { useAppStore } from '@/lib/store';
import type { HealthCheck } from '@/lib/healthgate';

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;
  const { healthSnapshot, canLaunch, setHealthSnapshot, setActiveAccountId } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [dataFormat, setDataFormat] = useState<string[] | null>(null);

  useEffect(() => {
    if (accountId) {
      setActiveAccountId(accountId);
      fetchHealth();
    }
  }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchHealth = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/health/sync?account_id=${encodeURIComponent(accountId)}`);
      const data = await res.json();
      if (res.status >= 500) { setApiError(data.error || 'Unknown server error'); return; }
      if (res.status === 404) { setApiError(`Account ${accountId} not found. Connect it first.`); return; }
      if (!res.ok) { setApiError(data.error || `HTTP ${res.status}`); return; }
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

  // ── Error state ──────────────────────────────────────────────────────
  if (apiError) {
    const isAuthError = apiError.includes('190') || apiError.includes('OAuth') || apiError.includes('token');
    return (
      <div className="max-w-2xl space-y-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-[0.8125rem] text-[#8C8880] hover:text-[#111110] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-[#DC2626]/20 p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
            <p className="font-display font-bold text-[1rem] tracking-[-0.01em] text-[#DC2626]">Meta API Error</p>
          </div>
          <p className="text-[0.8125rem] text-[#8C8880] font-mono break-all border border-[#E8E4DC] bg-[#FAFAF8] rounded-lg px-3 py-2">
            {apiError}
          </p>
          <div className="flex gap-2 pt-1">
            {isAuthError && (
              <button onClick={() => { window.location.href = '/api/auth/meta/start'; }}
                className="h-8 px-4 rounded-full bg-[#111110] text-white text-[0.8125rem] font-medium hover:bg-[#111110]/90 transition-colors flex items-center gap-1.5">
                <ExternalLink className="w-3 h-3" /> Re-authenticate
              </button>
            )}
            <button onClick={fetchHealth} disabled={loading}
              className="h-8 px-4 rounded-full border border-[#E8E4DC] text-[#111110] text-[0.8125rem] font-medium hover:bg-[#F3F0EB] transition-colors flex items-center gap-1.5 disabled:opacity-40">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Retry
            </button>
            <button onClick={() => router.push('/accounts')}
              className="h-8 px-4 rounded-full border border-[#E8E4DC] text-[#8C8880] text-[0.8125rem] font-medium hover:bg-[#F3F0EB] transition-colors">
              Back to Accounts
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────
  if (loading && !healthSnapshot) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-6 h-6 text-[#8C8880] animate-spin" />
        <p className="text-[0.875rem] text-[#8C8880]">Fetching account health from Meta…</p>
      </div>
    );
  }

  // ── No data state ────────────────────────────────────────────────────
  if (!healthSnapshot) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 rounded-full border border-[#E8E4DC] bg-white flex items-center justify-center">
          <Shield className="w-6 h-6 text-[#8C8880]" />
        </div>
        <div className="text-center">
          <p className="text-[0.9375rem] font-medium text-[#111110]">No health data</p>
          <p className="text-[0.875rem] text-[#8C8880] mt-0.5">Connect an account first.</p>
        </div>
        <button onClick={() => router.push('/accounts')}
          className="h-9 px-5 rounded-full bg-[#111110] text-white text-[0.875rem] font-medium hover:bg-[#111110]/90 transition-colors">
          Go to Accounts
        </button>
      </div>
    );
  }

  const statusCfg = {
    green:  { border: 'border-[#059669]/20', bg: 'bg-[#ECFDF5]', text: 'text-[#059669]',  label: `Launch Ready — ${healthSnapshot.score}/100` },
    yellow: { border: 'border-[#D97706]/20', bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]',  label: `Review Recommended — ${healthSnapshot.score}/100` },
    red:    { border: 'border-[#DC2626]/20', bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]',  label: `Launch Blocked — ${healthSnapshot.score}/100` },
  }[healthSnapshot.status] ?? { border: 'border-[#E8E4DC]', bg: 'bg-white', text: 'text-[#8C8880]', label: `Score ${healthSnapshot.score}/100` };

  // ── Main view ────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl space-y-6">

      {/* Header */}
      <div className="space-y-1">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[0.8125rem] text-[#8C8880] hover:text-[#111110] transition-colors mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Accounts
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.75rem] font-medium uppercase tracking-[0.1em] text-[#8C8880]">Healthgate™</p>
            <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.03em] text-[#111110]">Account Health</h1>
            <p className="text-[0.875rem] text-[#8C8880] font-mono mt-0.5 truncate max-w-xs">{accountId}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={fetchHealth} disabled={loading}
              className="h-8 px-3.5 rounded-full border border-[#E8E4DC] text-[0.8125rem] font-medium text-[#8C8880] hover:text-[#111110] hover:bg-[#F3F0EB] transition-colors flex items-center gap-1.5 disabled:opacity-40">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <HealthgateRing score={healthSnapshot.score} status={healthSnapshot.status} checks={healthSnapshot.checks} size={56} />
          </div>
        </div>
      </div>

      {/* Status banner */}
      <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border ${statusCfg.border} ${statusCfg.bg}`}>
        <Shield className={`w-4 h-4 shrink-0 ${statusCfg.text}`} />
        <p className={`text-[0.9375rem] font-semibold ${statusCfg.text}`}>{statusCfg.label}</p>
        {healthSnapshot.status === 'red' && (
          <p className="text-[0.8125rem] text-[#8C8880] ml-1">· Fix failing checks below to unlock tests.</p>
        )}
      </div>

      {/* Healthgate table */}
      <div className="bg-white rounded-xl border border-[#E8E4DC] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E8E4DC] flex items-center justify-between">
          <p className="font-display font-bold text-[1rem] tracking-[-0.01em] text-[#111110]">
            Healthgate™ 12-Point Inspection
          </p>
          {dataFormat && (
            <span className="text-[0.6875rem] font-mono text-[#8C8880] border border-[#E8E4DC] bg-[#FAFAF8] px-2 py-0.5 rounded">
              Meta: {dataFormat.join(', ')}
            </span>
          )}
        </div>
        <table className="w-full text-[0.875rem]">
          <thead>
            <tr className="border-b border-[#E8E4DC] bg-[#FAFAF8]">
              <th className="py-2.5 px-4 text-left text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] w-8"></th>
              <th className="py-2.5 px-4 text-left text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[#8C8880]">Check</th>
              <th className="py-2.5 px-4 text-left text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[#8C8880]">Value</th>
              <th className="py-2.5 px-4 text-right text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[#8C8880]">Points</th>
              <th className="py-2.5 px-4 text-left text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[#8C8880]">Fix</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E4DC]">
            {healthSnapshot.checks.map((check: HealthCheck) => {
              const isSandbox = typeof check.value === 'string' && check.value.includes('sandbox');
              return (
                <tr key={check.key} className="hover:bg-[#F3F0EB] transition-colors">
                  <td className="py-3 px-4">
                    <StatusDot status={check.passed ? 'green' : 'red'} />
                  </td>
                  <td className="py-3 px-4 font-medium text-[#111110]">{check.name}</td>
                  <td className="py-3 px-4 text-[#8C8880] font-mono tabular-nums text-[0.8125rem]">
                    {check.value}
                    {isSandbox && (
                      <span className="ml-1.5 text-[0.625rem] text-[#D97706]" title="Assumed pass in Sandbox">ⓘ</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-[0.8125rem]">
                    <span className={check.passed ? 'text-[#059669]' : 'text-[#DC2626]'}>{check.points}</span>
                    <span className="text-[#8C8880]">/{check.maxPoints}</span>
                  </td>
                  <td className="py-3 px-4 text-[0.75rem] text-[#8C8880] max-w-[200px]">
                    {!check.passed && check.fix}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#E8E4DC] bg-[#FAFAF8]">
              <td colSpan={3} className="py-3.5 px-4 font-semibold text-[0.9375rem] text-[#111110]">Total Score</td>
              <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-[1.5rem] text-[#111110]">
                {healthSnapshot.score}
                <span className="text-[1rem] font-normal text-[#8C8880]">/100</span>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/tests/new')}
          disabled={!canLaunch}
          className="h-9 px-5 rounded-full bg-[#111110] text-white text-[0.875rem] font-medium hover:bg-[#111110]/90 transition-colors disabled:opacity-40"
        >
          {canLaunch ? 'Create New Test' : 'Blocked by Healthgate'}
        </button>
        <button
          onClick={() => router.push('/accounts')}
          className="h-9 px-4 rounded-full border border-[#E8E4DC] text-[#8C8880] text-[0.875rem] font-medium hover:bg-[#F3F0EB] hover:text-[#111110] transition-colors"
        >
          Back to Accounts
        </button>
      </div>
    </div>
  );
}