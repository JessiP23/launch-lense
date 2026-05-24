'use client';

import { useIntelligence } from '@/hooks/use-intelligence';

const C = { ink: '#111110', muted: '#8C8880', border: '#E8E4DC', surface: '#FFFFFF', faint: '#F3F0EB' };

const VERTICAL_KEYWORDS: Record<string, string[]> = {
  fintech: ['bank', 'finance', 'payment', 'crypto', 'trading', 'invest', 'loan', 'credit'],
  health: ['health', 'medical', 'doctor', 'wellness', 'fitness', 'therapy', 'pharma'],
  saas: ['software', 'platform', 'tool', 'app', 'dashboard', 'analytics', 'automation'],
  ecommerce: ['shop', 'store', 'market', 'sell', 'buy', 'retail', 'commerce'],
  marketplace: ['marketplace', 'platform', 'connect', 'matching', 'gig', 'freelance'],
  edtech: ['education', 'learn', 'course', 'teach', 'school', 'training', 'skill'],
  consumer: ['social', 'lifestyle', 'personal', 'home', 'family', 'daily'],
  b2b: ['enterprise', 'business', 'corporate', 'professional', 'workflow', 'productivity'],
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
    ? `Genome correctly predicted campaign outcomes in ${bestAccuracy.toFixed(0)}% of ${bestVertical} sprints — the highest accuracy vertical with ${(verticalAccuracy[bestVertical] as { matches: number; total: number }).total} sprints completed.`
    : 'Insufficient data to generate insights. Complete at least 5 sprints in a vertical to see prediction accuracy.';

  if (isLoading) {
    return (
      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ height: 64, background: C.faint, borderRadius: 8 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
      <p style={{ fontSize: '0.875rem', color: C.ink, lineHeight: 1.6 }}>{insight}</p>
    </div>
  );
}
