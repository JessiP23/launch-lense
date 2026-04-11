'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, RefreshCw, ArrowLeft } from 'lucide-react';
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
  const { healthSnapshot, canLaunch } = useAppStore();

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Account Health</h1>
          <p className="text-sm text-[#A1A1A1] mt-0.5">
            ID: {params.id as string}
          </p>
        </div>
        <HealthgateRing
          score={healthSnapshot.score}
          status={healthSnapshot.status}
          checks={healthSnapshot.checks}
          size={64}
        />
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
              {healthSnapshot.checks.map((check: HealthCheck) => (
                <tr
                  key={check.key}
                  className="border-b border-[#262626]/50 h-10 hover:bg-[#111111] transition-colors"
                >
                  <td className="py-2 px-3">
                    <StatusDot status={check.passed ? 'green' : 'red'} />
                  </td>
                  <td className="py-2 px-3 font-medium">{check.name}</td>
                  <td className="py-2 px-3 text-[#A1A1A1] font-mono tabular-nums">{check.value}</td>
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
              ))}
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
