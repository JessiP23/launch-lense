'use client';

import { useAppStore } from '@/lib/store';
import { useMarket } from '@/hooks/use-market';
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

export function WinningAngleArchetypes({ orgId }: { orgId: string | null }) {
  const { angleResults, isLoading } = useMarket(orgId);

  if (isLoading) {
    return (
      <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          WINNING ANGLE ARCHETYPES
        </div>
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
          Loading...
        </div>
      </div>
    );
  }

  // Group angles by archetype (simplified: use angle name as archetype)
  const archetypeData = angleResults.reduce((acc: any, result: any) => {
    const archetype = result.angle_name || 'Unknown';
    if (!acc[archetype]) {
      acc[archetype] = { count: 0, totalCtr: 0 };
    }
    acc[archetype].count++;
    acc[archetype].totalCtr += result.ctr || 0;
    return acc;
  }, {});

  const chartData = Object.entries(archetypeData)
    .map(([archetype, data]: [string, any]) => ({
      archetype,
      avgCtr: data.count > 0 ? (data.totalCtr / data.count) * 100 : 0,
      count: data.count,
    }))
    .filter((d: any) => d.count > 0)
    .sort((a: any, b: any) => b.avgCtr - a.avgCtr)
    .slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}
    >
      <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        WINNING ANGLE ARCHETYPES
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {chartData.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            No angle data yet.
          </div>
        ) : (
          chartData.map((row: any, index: number) => (
            <div key={row.archetype} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 120, fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.archetype}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(row.avgCtr * 10, 100)}%` }}
                  transition={{ duration: 0.6, delay: index * 0.1, ease: 'easeOut' }}
                  style={{ height: '6px', background: 'var(--accent-blue)', borderRadius: 1 }}
                />
                <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {row.avgCtr.toFixed(2)}%
                </div>
              </div>
              <div style={{ width: 60, fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textAlign: 'right' }}>
                {row.count}
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
