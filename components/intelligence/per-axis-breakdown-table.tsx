'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">Per-Axis Breakdown</h3>
        <Skeleton className="h-64" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-4">Per-Axis Breakdown (GO vs NO-GO)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-medium text-ink-3">Axis</th>
              <th className="text-right py-2 px-3 font-medium text-ink-3">Avg GO Score</th>
              <th className="text-right py-2 px-3 font-medium text-ink-3">Avg NO-GO Score</th>
              <th className="text-right py-2 px-3 font-medium text-ink-3">Delta</th>
            </tr>
          </thead>
          <tbody>
            {axisData.map((row) => (
              <tr key={row.axis} className="border-b border-border/50">
                <td className="py-2 px-3 capitalize">{row.axis}</td>
                <td className="text-right py-2 px-3">{row.avgGoScore.toFixed(1)}</td>
                <td className="text-right py-2 px-3">{row.avgNoGoScore.toFixed(1)}</td>
                <td className={`text-right py-2 px-3 font-medium ${row.delta > 0 ? 'text-success' : row.delta < 0 ? 'text-danger' : 'text-ink-2'}`}>
                  {row.delta > 0 ? '+' : ''}{row.delta.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
