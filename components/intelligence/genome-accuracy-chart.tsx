'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const C = { ink: '#111110', muted: '#8C8880', border: '#E8E4DC', surface: '#FFFFFF', faint: '#F3F0EB' };

export function GenomeAccuracyChart({ orgId }: { orgId: string | null }) {
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
    return {
      sprint: point.sprint,
      accuracy: (avg * 100).toFixed(1),
    };
  });

  if (isLoading) {
    return (
      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 16, color: C.ink }}>Genome vs Campaign Accuracy</h3>
        <div className="h-[250px] bg-faint rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 16, color: C.ink }}>Genome vs Campaign Accuracy</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={rollingData}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="sprint" label={{ value: 'Sprint #', position: 'insideBottom', offset: -5, fill: C.muted, fontSize: 12 }} stroke={C.muted} />
          <YAxis label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: C.muted, fontSize: 12 }} stroke={C.muted} />
          <Tooltip formatter={(value: any) => `${value}%`} contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8 }} />
          <Line
            type="monotone"
            dataKey="accuracy"
            stroke="#059669"
            strokeWidth={2}
            dot={{ r: 3, fill: '#059669' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
