'use client';

import { useIntelligence } from '@/hooks/use-intelligence';

export function HeaderStats({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);

  const totalSprints = sprints.length;
  const noGoCount = sprints.filter(
    (s: any) => s.verdict?.aggregate_verdict === 'NO-GO'
  ).length;
  const capitalPreserved = noGoCount * 150000;

  // Calculate Genome accuracy
  let matches = 0;
  let totalWithGenome = 0;
  sprints.forEach((sprint: any) => {
    const genomeSignal = sprint.genome?.signal;
    const verdict = sprint.verdict?.aggregate_verdict;
    if (genomeSignal && verdict) {
      totalWithGenome++;
      const mappedSignal = genomeSignal === 'STOP' ? 'NO-GO' : genomeSignal;
      if (mappedSignal === verdict) matches++;
    }
  });
  const accuracy = totalWithGenome > 0 ? (matches / totalWithGenome) * 100 : 0;

  // Calculate delta vs last 7 sprints
  const last7Sprints = sprints.slice(-7);
  let last7Matches = 0;
  let last7Total = 0;
  last7Sprints.forEach((sprint: any) => {
    const genomeSignal = sprint.genome?.signal;
    const verdict = sprint.verdict?.aggregate_verdict;
    if (genomeSignal && verdict) {
      last7Total++;
      const mappedSignal = genomeSignal === 'STOP' ? 'NO-GO' : genomeSignal;
      if (mappedSignal === verdict) last7Matches++;
    }
  });
  const last7Accuracy = last7Total > 0 ? (last7Matches / last7Total) * 100 : 0;
  const accuracyDelta = last7Total > 0 ? accuracy - last7Accuracy : 0;

  // Calculate Avg Winning CTR
  const goSprints = sprints.filter((s: any) => s.verdict?.aggregate_verdict === 'GO');
  const avgWinningCtr = goSprints.length > 0
    ? goSprints.reduce((sum: number, s: any) => sum + (s.campaign?.angle_metrics?.blended_ctr || 0), 0) / goSprints.length
    : 0;

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: '1px solid var(--surface-border)' }}>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            style={{
              padding: '24px 16px',
              borderRight: i < 3 ? '1px solid var(--surface-border)' : 'none',
            }}
          >
            <div style={{ height: 12, width: 80, background: 'var(--text-tertiary)', marginBottom: 12 }} />
            <div style={{ height: 32, width: 120, background: 'var(--text-tertiary)' }} />
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: 'TOTAL SPRINTS',
      value: totalSprints.toString(),
      delta: null,
    },
    {
      label: 'CAPITAL PRESERVED',
      value: `$${(capitalPreserved / 1000000).toFixed(1)}M`,
      delta: null,
    },
    {
      label: 'GENOME ACCURACY',
      value: `${accuracy.toFixed(1)}%`,
      delta: accuracyDelta,
    },
    {
      label: 'AVG WINNING CTR',
      value: `${(avgWinningCtr * 100).toFixed(2)}%`,
      delta: null,
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: '1px solid var(--surface-border)' }}>
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          style={{
            padding: '24px 16px',
            borderRight: i < 3 ? '1px solid var(--surface-border)' : 'none',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {stat.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontSize: '30px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
              {stat.value}
            </div>
            {stat.delta !== null && (
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: stat.delta >= 0 ? 'var(--signal-go)' : 'var(--signal-no-go)',
                fontFamily: 'var(--font-mono)',
              }}>
                {stat.delta >= 0 ? '↑' : '↓'} {Math.abs(stat.delta).toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
