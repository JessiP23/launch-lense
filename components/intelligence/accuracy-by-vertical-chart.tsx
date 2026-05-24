'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
import { motion } from 'framer-motion';

const VERTICAL_KEYWORDS: Record<string, string[]> = {
  fintech: ['bank', 'finance', 'payment', 'crypto', 'trading', 'invest', 'loan', 'credit', 'insurance'],
  health: ['health', 'medical', 'doctor', 'wellness', 'fitness', 'therapy', 'pharma', 'patient', 'mental'],
  saas: ['software', 'platform', 'tool', 'app', 'dashboard', 'analytics', 'automation', 'api', 'workflow'],
  ecommerce: ['shop', 'store', 'market', 'sell', 'buy', 'retail', 'commerce', 'product', 'marketplace'],
  consumer: ['social', 'lifestyle', 'personal', 'home', 'family', 'daily', 'app', 'community'],
  b2b: ['enterprise', 'business', 'corporate', 'professional', 'team', 'company', 'B2B'],
};

function classifyVertical(idea: string): string {
  const lowerIdea = idea.toLowerCase();
  for (const [vertical, keywords] of Object.entries(VERTICAL_KEYWORDS)) {
    if (keywords.some((kw) => lowerIdea.includes(kw))) {
      return vertical;
    }
  }
  return 'other';
}

function interpolateColor(accuracy: number): string {
  // Interpolate between --signal-no-go (0%) and --signal-go (100%)
  const noGoColor = { r: 255, g: 59, b: 92 }; // #FF3B5C
  const goColor = { r: 0, g: 255, b: 148 }; // #00FF94
  const ratio = accuracy / 100;
  const r = Math.round(noGoColor.r + (goColor.r - noGoColor.r) * ratio);
  const g = Math.round(noGoColor.g + (goColor.g - noGoColor.g) * ratio);
  const b = Math.round(noGoColor.b + (goColor.b - noGoColor.b) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

export function AccuracyByVerticalChart({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);

  // Calculate accuracy by vertical
  const verticalAccuracy = sprints.reduce((acc: any, sprint: any) => {
    const vertical = classifyVertical(sprint.idea);
    if (!acc[vertical]) {
      acc[vertical] = { matches: 0, total: 0 };
    }
    const genomeSignal = sprint.genome?.signal;
    const verdict = sprint.verdict?.aggregate_verdict;
    if (genomeSignal && verdict) {
      acc[vertical].total++;
      const mappedSignal = genomeSignal === 'STOP' ? 'NO-GO' : genomeSignal;
      if (mappedSignal === verdict) acc[vertical].matches++;
    }
    return acc;
  }, {});

  const chartData = Object.entries(verticalAccuracy)
    .map(([vertical, data]: [string, any]) => ({
      vertical,
      accuracy: data.total > 0 ? ((data.matches / data.total) * 100) : 0,
      count: data.total,
    }))
    .filter((d: any) => d.count > 0)
    .sort((a: any, b: any) => b.accuracy - a.accuracy);

  if (isLoading) {
    return (
      <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          ACCURACY BY VERTICAL
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
        ACCURACY BY VERTICAL
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {chartData.map((row: any, index: number) => (
          <div key={row.vertical} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 80, fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
              {row.vertical}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${row.accuracy}%` }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: 'easeOut' }}
                style={{ height: '6px', background: interpolateColor(row.accuracy), borderRadius: 1 }}
              />
              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {row.accuracy.toFixed(1)}%
              </div>
            </div>
            <div style={{ width: 60, fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textAlign: 'right' }}>
              {row.count}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
