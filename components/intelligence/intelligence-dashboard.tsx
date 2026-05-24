'use client';

import { useAppStore } from '@/lib/store';
import { useIntelligence } from '@/hooks/use-intelligence';
import { HeaderStats } from './header-stats';
import { VerdictDistributionChart } from './verdict-distribution-chart';
import { GenomeAccuracyChart } from './genome-accuracy-chart';
import { VerticalPerformanceTable } from './vertical-performance-table';
import { LiveVerdictFeed } from './live-verdict-feed';
import { IntelligencePaywall } from './intelligence-paywall';

export function IntelligenceDashboard() {
  const orgId = useAppStore((s) => s.orgId);
  const { sprints, hasAccess, isLoading } = useIntelligence(orgId);

  if (!hasAccess) {
    return <IntelligencePaywall />;
  }

  return (
    <div className="space-y-6">
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
