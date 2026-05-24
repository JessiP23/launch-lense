'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = {
  GO: '#22c55e',
  'NO-GO': '#ef4444',
  ITERATE: '#f59e0b',
};

export function VerdictDistributionChart({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);

  const verdictCounts = sprints.reduce(
    (acc: any, sprint: any) => {
      const verdict = sprint.verdict?.aggregate_verdict || 'UNKNOWN';
      acc[verdict] = (acc[verdict] || 0) + 1;
      return acc;
    },
    { GO: 0, 'NO-GO': 0, ITERATE: 0 }
  );

  const data = [
    { name: 'GO', value: verdictCounts.GO, color: COLORS.GO },
    { name: 'NO-GO', value: verdictCounts['NO-GO'], color: COLORS['NO-GO'] },
    { name: 'ITERATE', value: verdictCounts.ITERATE, color: COLORS.ITERATE },
  ].filter((d) => d.value > 0);

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">Verdict Distribution</h3>
        <Skeleton className="h-64" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-4">Verdict Distribution</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Legend />
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
