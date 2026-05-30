'use client';

import { useAppStore } from '@/lib/store';
import { useIntelligence } from '@/hooks/use-intelligence';
import { HeaderStats } from './header-stats';
import { VerdictDonutChart } from './verdict-donut-chart';
import { GenomeAccuracyChart } from './genome-accuracy-chart';
import { CalibrationAccuracyChart } from './calibration-accuracy-chart';
import { VerticalPerformanceHeatmap } from './vertical-performance-heatmap';
import { VerticalPerformanceTable } from './vertical-performance-table';
import { LiveSignalFeed } from './live-signal-feed';
import { IntelligencePaywall } from './intelligence-paywall';

export function IntelligenceDashboard() {
  const orgId = useAppStore((s) => s.orgId);
  const { sprints, hasAccess, isLoading } = useIntelligence(orgId);

  if (!hasAccess) {
    return <IntelligencePaywall />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <HeaderStats orgId={orgId} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0 }}>
        <VerdictDonutChart orgId={orgId} />
        <GenomeAccuracyChart orgId={orgId} />
      </div>

      <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '24px' }}>
        <CalibrationAccuracyChart orgId={orgId} />
      </div>

      <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '24px' }}>
        <VerticalPerformanceHeatmap orgId={orgId} />
      </div>

      <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '24px' }}>
        <VerticalPerformanceTable orgId={orgId} />
      </div>

      <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '24px' }}>
        <LiveSignalFeed orgId={orgId} />
      </div>
    </div>
  );
}
