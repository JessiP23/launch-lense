'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const VERDICT_COLORS: Record<string, string> = {
  GO: '#22c55e',
  'NO-GO': '#ef4444',
  ITERATE: '#f59e0b',
};

export function CalibrationScatterPlot({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);

  // Prepare scatter plot data
  const scatterData = sprints
    .filter((sprint: any) => sprint.genome?.composite_score && sprint.campaign?.angle_metrics?.blended_ctr)
    .map((sprint: any) => ({
      genomeScore: sprint.genome.composite_score,
      ctr: (sprint.campaign.angle_metrics.blended_ctr * 100).toFixed(2),
      verdict: sprint.verdict?.aggregate_verdict || 'UNKNOWN',
    }));

  // Calculate linear regression trendline
  const n = scatterData.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  scatterData.forEach((point: any) => {
    const x = point.genomeScore;
    const y = parseFloat(point.ctr);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;
  const intercept = n > 0 ? (sumY - slope * sumX) / n : 0;

  // Generate trendline points
  const trendlineData = [
    { x: 0, y: intercept },
    { x: 100, y: slope * 100 + intercept },
  ];

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">Calibration: Genome Score vs CTR</h3>
        <Skeleton className="h-64" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-4">Calibration: Genome Score vs CTR</h3>
      <ResponsiveContainer width="100%" height={250}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="genomeScore" 
            name="Genome Score" 
            label={{ value: 'Genome Score', position: 'insideBottom', offset: -5 }}
            domain={[0, 100]}
          />
          <YAxis 
            dataKey="ctr" 
            name="CTR" 
            label={{ value: 'CTR %', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            content={({ active, payload }: any) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-surface-1 border border-border rounded p-2 text-xs">
                    <div>Genome: {data.genomeScore}</div>
                    <div>CTR: {data.ctr}%</div>
                    <div>Verdict: {data.verdict}</div>
                  </div>
                );
              }
              return null;
            }}
          />
          {Object.entries(VERDICT_COLORS).map(([verdict, color]) => (
            <Scatter 
              key={verdict}
              data={scatterData.filter((p: any) => p.verdict === verdict)} 
              fill={color}
            />
          ))}
          <LineChart data={trendlineData}>
            <Line 
              type="linear" 
              dataKey="y" 
              stroke="#3b82f6" 
              strokeWidth={2} 
              dot={false}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ScatterChart>
      </ResponsiveContainer>
    </Card>
  );
}
