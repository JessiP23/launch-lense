'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
import { motion } from 'framer-motion';

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
      <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          PER-AXIS PREDICTIVE POWER
        </div>
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}
    >
      <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        PER-AXIS PREDICTIVE POWER
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {axisData.map((row, index) => (
          <div key={row.axis} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 80, fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
              {row.axis}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: `${row.avgGoScore}%`, height: '6px', background: 'var(--signal-go)', borderRadius: 1 }} />
                <div style={{ width: `${row.avgNoGoScore}%`, height: '6px', background: 'var(--signal-no-go)', borderRadius: 1 }} />
              </div>
            </div>
            <div style={{ width: 60, fontSize: '12px', fontFamily: 'var(--font-mono)', color: row.delta > 0 ? 'var(--signal-go)' : 'var(--signal-no-go)', textAlign: 'right' }}>
              {row.delta > 0 ? '+' : ''}{row.delta.toFixed(1)}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
