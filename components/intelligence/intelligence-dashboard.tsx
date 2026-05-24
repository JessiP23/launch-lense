'use client';

import { useAppStore } from '@/lib/store';
import { HeaderStats } from './header-stats';
import { VerdictDistributionChart } from './verdict-distribution-chart';
import { GenomeAccuracyChart } from './genome-accuracy-chart';
import { VerticalPerformanceTable } from './vertical-performance-table';
import { LiveVerdictFeed } from './live-verdict-feed';

export function IntelligenceDashboard() {
  const orgId = useAppStore((s) => s.orgId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Investor Intelligence</h1>
      </div>

      <HeaderStats orgId={orgId} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VerdictDistributionChart orgId={orgId} />
        <GenomeAccuracyChart orgId={orgId} />
      </div>

      <VerticalPerformanceTable orgId={orgId} />

      <LiveVerdictFeed orgId={orgId} />
    </div>
  );
}
