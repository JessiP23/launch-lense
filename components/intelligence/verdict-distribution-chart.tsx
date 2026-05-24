'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

const C = { ink: '#111110', muted: '#8C8880', border: '#E8E4DC', surface: '#FFFFFF', faint: '#F3F0EB' };

const COLORS = {
  GO: '#059669',
  'NO-GO': '#DC2626',
  ITERATE: '#D97706',
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
      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 16, color: C.ink }}>Verdict Distribution</h3>
        <div className="h-[250px] bg-faint rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 16, color: C.ink }}>Verdict Distribution</h3>
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
    </div>
  );
}
