'use client';

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

export function VerticalMomentum({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useMarket(orgId);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  // Calculate momentum scores
  const verticalData = sprints.reduce((acc: any, sprint: any) => {
    const vertical = classifyVertical(sprint.idea);
    if (!acc[vertical]) {
      acc[vertical] = { goLast30: 0, goPrior30: 0, goTotal: 0 };
    }
    const verdict = sprint.verdict?.aggregate_verdict;
    const createdAt = new Date(sprint.created_at);
    if (verdict === 'GO') {
      acc[vertical].goTotal++;
      if (createdAt >= thirtyDaysAgo) {
        acc[vertical].goLast30++;
      } else if (createdAt >= sixtyDaysAgo) {
        acc[vertical].goPrior30++;
      }
    }
    return acc;
  }, {});

  const momentumData = Object.entries(verticalData)
    .map(([vertical, data]: [string, any]) => {
      const momentum = data.goTotal > 0 ? (data.goLast30 / data.goTotal) * 100 : 0;
      const priorMomentum = data.goTotal > 0 ? (data.goPrior30 / data.goTotal) * 100 : 0;
      const trend = momentum > priorMomentum ? 'up' : momentum < priorMomentum ? 'down' : 'flat';
      return {
        vertical,
        momentum: momentum.toFixed(0),
        trend,
        goLast30: data.goLast30,
      };
    })
    .filter((d: any) => d.goLast30 > 0)
    .sort((a: any, b: any) => parseFloat(b.momentum) - parseFloat(a.momentum));

  if (isLoading) {
    return (
      <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          VERTICAL MOMENTUM
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
        VERTICAL MOMENTUM
      </div>
      {momentumData.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          No GO verdict sprints in the last 30 days.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {momentumData.map((item: any, index: number) => (
            <motion.div
              key={item.vertical}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid var(--surface-border)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-elevated)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  {item.vertical}
                </span>
                {index === 0 && <span style={{ fontSize: '10px', color: 'var(--signal-go)', fontFamily: 'var(--font-mono)' }}>HEATING UP</span>}
                {index === momentumData.length - 1 && <span style={{ fontSize: '10px', color: 'var(--signal-no-go)', fontFamily: 'var(--font-mono)' }}>COOLING</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {item.momentum}%
                </span>
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: item.trend === 'up' ? 'var(--signal-go)' : item.trend === 'down' ? 'var(--signal-no-go)' : 'var(--signal-neutral)' }}>
                  {item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
