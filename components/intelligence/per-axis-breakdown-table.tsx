'use client';

import { useIntelligence } from '@/hooks/use-intelligence';

const C = { ink: '#111110', muted: '#8C8880', border: '#E8E4DC', surface: '#FFFFFF', faint: '#F3F0EB', go: '#059669', stop: '#DC2626' };

const GENOME_AXES = ['demand', 'competition', 'icp', 'timing', 'moat'];

export function PerAxisBreakdownTable({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);

  // Calculate per-axis breakdown
  const axisData = GENOME_AXES.map((axis) => {
    const goSprints = sprints.filter((s: any) => s.verdict?.aggregate_verdict === 'GO');
    const noGoSprints = sprints.filter((s: any) => s.verdict?.aggregate_verdict === 'NO-GO');

    const goScores = goSprints
      .map((s: any) => s.genome?.scores?.[axis])
      .filter((s: any) => s !== undefined);
    const noGoScores = noGoSprints
      .map((s: any) => s.genome?.scores?.[axis])
      .filter((s: any) => s !== undefined);

    const avgGoScore = goScores.length > 0 ? goScores.reduce((a: number, b: number) => a + b, 0) / goScores.length : 0;
    const avgNoGoScore = noGoScores.length > 0 ? noGoScores.reduce((a: number, b: number) => a + b, 0) / noGoScores.length : 0;
    const delta = avgGoScore - avgNoGoScore;

    return {
      axis,
      avgGoScore,
      avgNoGoScore,
      delta,
    };
  }).sort((a, b) => b.delta - a.delta);

  if (isLoading) {
    return (
      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 16, color: C.ink }}>Per-Axis Breakdown</h3>
        <div style={{ height: 250, background: C.faint, borderRadius: 8 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 16, color: C.ink }}>Per-Axis Breakdown (GO vs NO-GO)</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: C.muted }}>Axis</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, color: C.muted }}>Avg GO Score</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, color: C.muted }}>Avg NO-GO Score</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, color: C.muted }}>Delta</th>
            </tr>
          </thead>
          <tbody>
            {axisData.map((row) => (
              <tr key={row.axis} style={{ borderBottom: `1px solid ${C.border}50` }}>
                <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{row.axis}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px' }}>{row.avgGoScore.toFixed(1)}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px' }}>{row.avgNoGoScore.toFixed(1)}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: row.delta > 0 ? C.go : row.delta < 0 ? C.stop : C.ink }}>
                  {row.delta > 0 ? '+' : ''}{row.delta.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
