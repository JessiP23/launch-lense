'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
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

export function VerticalPerformanceTable({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);

  const verticalData = sprints.reduce((acc: any, sprint: any) => {
    const vertical = classifyVertical(sprint.idea);
    if (!acc[vertical]) {
      acc[vertical] = {
        vertical,
        count: 0,
        totalCtr: 0,
        totalCpc: 0,
        goCount: 0,
        totalGenomeScore: 0,
      };
    }
    acc[vertical].count++;
    const ctr = sprint.campaign?.angle_metrics?.blended_ctr || 0;
    const cpc = sprint.campaign?.angle_metrics?.blended_cpc_cents || 0;
    acc[vertical].totalCtr += ctr;
    acc[vertical].totalCpc += cpc;
    if (sprint.verdict?.aggregate_verdict === 'GO') {
      acc[vertical].goCount++;
    }
    const genomeScore = sprint.genome?.composite_score || 0;
    acc[vertical].totalGenomeScore += genomeScore;
    return acc;
  }, {});

  const tableData = Object.values(verticalData)
    .map((v: any) => ({
      vertical: v.vertical,
      sprintCount: v.count,
      avgCtr: v.count > 0 ? (v.totalCtr / v.count) * 100 : 0,
      avgCpc: v.count > 0 ? v.totalCpc / v.count / 100 : 0,
      goRate: v.count > 0 ? (v.goCount / v.count) * 100 : 0,
      avgGenomeScore: v.count > 0 ? v.totalGenomeScore / v.count : 0,
    }))
    .filter((v: any) => v.sprintCount > 0)
    .sort((a: any, b: any) => b.goRate - a.goRate);

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">Vertical Performance</h3>
        <Skeleton className="h-64" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-4">Vertical Performance</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-medium text-ink-3">Vertical</th>
              <th className="text-right py-2 px-3 font-medium text-ink-3">Sprints</th>
              <th className="text-right py-2 px-3 font-medium text-ink-3">Avg CTR</th>
              <th className="text-right py-2 px-3 font-medium text-ink-3">Avg CPC</th>
              <th className="text-right py-2 px-3 font-medium text-ink-3">GO Rate</th>
              <th className="text-right py-2 px-3 font-medium text-ink-3">Avg Genome</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row: any) => (
              <tr key={row.vertical} className="border-b border-border/50">
                <td className="py-2 px-3 capitalize">{row.vertical}</td>
                <td className="text-right py-2 px-3">{row.sprintCount}</td>
                <td className="text-right py-2 px-3">{row.avgCtr.toFixed(2)}%</td>
                <td className="text-right py-2 px-3">${row.avgCpc.toFixed(2)}</td>
                <td className="text-right py-2 px-3">{row.goRate.toFixed(1)}%</td>
                <td className="text-right py-2 px-3">{row.avgGenomeScore.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
