'use client';

import { useAppStore } from '@/lib/store';
import { useIntelligence } from '@/hooks/use-intelligence';
import { PredictionInsightCard } from './prediction-insight-card';
import { CalibrationScatterPlot } from './calibration-scatter-plot';
import { PerAxisBreakdownTable } from './per-axis-breakdown-table';
import { AccuracyByVerticalChart } from './accuracy-by-vertical-chart';
import { IntelligencePaywall } from './intelligence-paywall';

export function PredictionEngine() {
  const orgId = useAppStore((s) => s.orgId);
  const { hasAccess } = useIntelligence(orgId);

  if (!hasAccess) {
    return <IntelligencePaywall />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PredictionInsightCard orgId={orgId} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0 }}>
        <CalibrationScatterPlot orgId={orgId} />
        <PerAxisBreakdownTable orgId={orgId} />
      </div>

      <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '24px' }}>
        <AccuracyByVerticalChart orgId={orgId} />
      </div>
    </div>
  );
}
