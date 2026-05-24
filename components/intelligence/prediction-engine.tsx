'use client';

import { useAppStore } from '@/lib/store';
import { PredictionInsightCard } from './prediction-insight-card';
import { AccuracyOverTimeChart } from './accuracy-over-time-chart';
import { CalibrationScatterPlot } from './calibration-scatter-plot';
import { PerAxisBreakdownTable } from './per-axis-breakdown-table';
import { AccuracyByVerticalChart } from './accuracy-by-vertical-chart';

export function PredictionEngine() {
  const orgId = useAppStore((s) => s.orgId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Prediction Engine</h1>
      </div>

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
