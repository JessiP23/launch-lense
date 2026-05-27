'use client';

import { useMarket } from '@/hooks/use-market';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

export function CompetitiveDensity({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useMarket(orgId);

  // Calculate competitive density by vertical
  const verticalData = sprints.reduce((acc: any, sprint: any) => {
    const vertical = classifyVertical(sprint.idea);
    if (!acc[vertical]) {
      acc[vertical] = { goMetaAds: 0, noGoMetaAds: 0, goCount: 0, noGoCount: 0 };
    }
    const verdict = sprint.verdict?.aggregate_verdict;
    const metaAdCount = sprint.genome?.meta_ad_count || 0;
    if (verdict === 'GO') {
      acc[vertical].goCount++;
      acc[vertical].goMetaAds += metaAdCount;
    } else if (verdict === 'NO-GO') {
      acc[vertical].noGoCount++;
      acc[vertical].noGoMetaAds += metaAdCount;
    }
    return acc;
  }, {});

  const chartData = Object.entries(verticalData)
    .map(([vertical, data]: [string, any]) => ({
      vertical,
      avgGoMetaAds: data.goCount > 0 ? data.goMetaAds / data.goCount : 0,
      avgNoGoMetaAds: data.noGoCount > 0 ? data.noGoMetaAds / data.noGoCount : 0,
      goCount: data.goCount,
    }))
    .filter((d: any) => d.goCount > 0 && d.avgGoMetaAds < d.avgNoGoMetaAds)
    .sort((a: any, b: any) => a.avgGoMetaAds - b.avgGoMetaAds)
    .slice(0, 6);

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">Low Competition Verticals with GO Verdicts</h3>
        <Skeleton className="h-64" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-4">Low Competition Verticals with GO Verdicts</h3>
      {chartData.length === 0 ? (
        <p className="text-sm text-ink-3">Insufficient data to show competitive density.</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" label={{ value: 'Avg Meta Ad Count', position: 'insideBottom', offset: -5 }} />
            <YAxis type="category" dataKey="vertical" width={80} label={{ value: 'Vertical', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Bar dataKey="avgGoMetaAds" fill="#22c55e" name="GO Avg Ads" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
