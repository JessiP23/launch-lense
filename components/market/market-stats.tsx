'use client';

import { useAppStore } from '@/lib/store';
import { useMarket } from '@/hooks/use-market';

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

export function MarketStats({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useMarket(orgId);

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: '1px solid var(--surface-border)' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ padding: '24px 16px', borderRight: i < 3 ? '1px solid var(--surface-border)' : 'none' }}>
            <div style={{ height: '12px', background: 'var(--surface-elevated)', marginBottom: 12, width: '60%' }} />
            <div style={{ height: '30px', background: 'var(--surface-elevated)', width: '40%' }} />
          </div>
        ))}
      </div>
    );
  }

  // Calculate stats
  const verticals = new Set(sprints.map((s: any) => classifyVertical(s.idea)));
  const activeVerticals = verticals.size;
  const totalSprints = sprints.length;
  const avgGenomeScore = sprints.length > 0
    ? sprints.reduce((sum: number, s: any) => sum + (s.genome?.composite_score || 0), 0) / sprints.length
    : 0;

  // Find hottest vertical (most sprints in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentSprints = sprints.filter((s: any) => new Date(s.created_at) > thirtyDaysAgo);
  const verticalCounts = recentSprints.reduce((acc: any, s: any) => {
    const vertical = classifyVertical(s.idea);
    acc[vertical] = (acc[vertical] || 0) + 1;
    return acc;
  }, {});
  const hottestVertical = Object.entries(verticalCounts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'N/A';

  const stats = [
    { label: 'ACTIVE VERTICALS', value: activeVerticals, delta: null },
    { label: 'HOTTEST VERTICAL', value: hottestVertical === 'N/A' ? 'N/A' : hottestVertical.charAt(0).toUpperCase() + hottestVertical.slice(1), delta: null },
    { label: 'TOTAL SPRINTS', value: totalSprints, delta: null },
    { label: 'AVG GENOME SCORE', value: avgGenomeScore.toFixed(1), delta: null },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: '1px solid var(--surface-border)' }}>
      {stats.map((stat, i) => (
        <div key={stat.label} style={{ padding: '24px 16px', borderRight: i < 3 ? '1px solid var(--surface-border)' : 'none' }}>
          <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {stat.label}
          </div>
          <div style={{ fontSize: '30px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
