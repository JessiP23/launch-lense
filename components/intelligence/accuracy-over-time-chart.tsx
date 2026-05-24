'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function AccuracyOverTimeChart({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);

  // Sort sprints by created_at ascending for time series
  const sortedSprints = [...sprints].sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Calculate accuracy per sprint (1 = match, 0 = miss)
  const accuracyData = sortedSprints.map((sprint: any, index: number) => {
    const genomeSignal = sprint.genome?.signal;
    const verdict = sprint.verdict?.aggregate_verdict;
    let match = 0;
    if (genomeSignal && verdict) {
      const mappedSignal = genomeSignal === 'STOP' ? 'NO-GO' : genomeSignal;
      match = mappedSignal === verdict ? 1 : 0;
    }
    return {
      sprint: index + 1,
      match,
    };
  });

  // Calculate 7-sprint rolling average
  const rollingData = accuracyData.map((point: any, index: number) => {
    const window = accuracyData.slice(Math.max(0, index - 6), index + 1);
    const avg = window.reduce((sum: number, p: any) => sum + p.match, 0) / window.length;
    
    // Calculate standard deviation for confidence bands
    const variance = window.reduce((sum: number, p: any) => sum + Math.pow(p.match - avg, 2), 0) / window.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      sprint: point.sprint,
      accuracy: (avg * 100).toFixed(1),
      upperBound: ((avg + stdDev) * 100).toFixed(1),
      lowerBound: Math.max(0, ((avg - stdDev) * 100)).toFixed(1),
    };
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">Accuracy Over Time</h3>
        <Skeleton className="h-80" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-4">Accuracy Over Time (with Confidence Bands)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={rollingData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="sprint" label={{ value: 'Sprint #', position: 'insideBottom', offset: -5 }} />
          <YAxis label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft' }} />
          <Tooltip formatter={(value: any) => `${value}%`} />
          <Area
            type="monotone"
            dataKey="upperBound"
            stroke="#3b82f6"
            strokeWidth={0}
            fill="#3b82f6"
            fillOpacity={0.1}
          />
          <Area
            type="monotone"
            dataKey="lowerBound"
            stroke="#3b82f6"
            strokeWidth={0}
            fill="#3b82f6"
            fillOpacity={0.1}
          />
          <Line
            type="monotone"
            dataKey="accuracy"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
