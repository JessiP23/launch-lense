'use client';

import { useIntelligence } from '@/hooks/use-intelligence';

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

export function PredictionInsightCard({ orgId }: { orgId: string | null }) {
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

  // Find highest accuracy vertical with 5+ sprints
  let bestVertical = null;
  let bestAccuracy = 0;
  for (const [vertical, data] of Object.entries(verticalAccuracy)) {
    const typedData = data as { matches: number; total: number };
    if (typedData.total >= 5) {
      const accuracy = (typedData.matches / typedData.total) * 100;
      if (accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
        bestVertical = vertical;
      }
    }
  }

  const insight = bestVertical
    ? `${bestVertical.charAt(0).toUpperCase() + bestVertical.slice(1)} ideas have the highest prediction accuracy at ${bestAccuracy.toFixed(0)}% across ${(verticalAccuracy[bestVertical] as { matches: number; total: number }).total} sprints — and improving.`
    : `Prediction accuracy improves with every sprint. ${sprints.length} sprints completed so far.`;

  if (isLoading) {
    return (
      <div style={{ padding: '24px 16px', background: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
        <div style={{ height: 40, background: 'var(--surface-elevated)' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 16px', background: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
      <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>{insight}</p>
    </div>
  );
}
