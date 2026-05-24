'use client';

import { useIntelligence } from '@/hooks/use-intelligence';

const C = { ink: '#111110', muted: '#8C8880', border: '#E8E4DC', surface: '#FFFFFF', faint: '#F3F0EB' };

export function HeaderStats({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);

  const totalSprints = sprints.length;
  const totalIdeas = sprints.length;
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

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ height: 80, background: C.faint, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  const stats = [
    { label: 'Total Sprints', value: totalSprints.toString() },
    { label: 'Ideas Validated', value: totalIdeas.toString() },
    { label: 'Capital Preserved', value: `$${(capitalPreserved / 10000).toFixed(0)}K` },
    { label: 'Genome Accuracy', value: `${accuracy.toFixed(1)}%` },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {stats.map((stat) => (
        <div
          key={stat.label}
          style={{
            padding: 20,
            borderRadius: 12,
            background: C.surface,
            border: `1px solid ${C.border}`,
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 500, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {stat.label}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: C.ink, letterSpacing: '-0.02em' }}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
