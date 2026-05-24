'use client';

import { useMarket } from '@/hooks/use-market';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">Vertical Momentum</h3>
        <Skeleton className="h-64" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-4">Vertical Momentum Scores</h3>
      {momentumData.length === 0 ? (
        <p className="text-sm text-ink-3">No GO verdict sprints in the last 30 days.</p>
      ) : (
        <div className="space-y-2">
          {momentumData.map((item: any, index: number) => (
            <div
              key={item.vertical}
              className="flex items-center justify-between p-2 rounded-lg bg-surface-2/50 border border-border/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium capitalize text-ink-1">{item.vertical}</span>
                {index === 0 && <span className="text-xs">🔥 Heating up</span>}
                {index === momentumData.length - 1 && <span className="text-xs">📉 Cooling</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink-2">{item.momentum}%</span>
                <span className="text-xs">
                  {item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
