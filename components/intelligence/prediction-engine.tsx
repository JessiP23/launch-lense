'use client';

import { useAppStore } from '@/lib/store';
import { useIntelligence } from '@/hooks/use-intelligence';
import { PredictionInsightCard } from './prediction-insight-card';
import { AccuracyOverTimeChart } from './accuracy-over-time-chart';
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
    <div className="space-y-6">
      <PredictionInsightCard orgId={orgId} />

      <AccuracyOverTimeChart orgId={orgId} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CalibrationScatterPlot orgId={orgId} />
        <AccuracyByVerticalChart orgId={orgId} />
      </div>

      <PerAxisBreakdownTable orgId={orgId} />
    </div>
  );
}
