'use client';

import { useMarket } from '@/hooks/use-market';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function DeadZone({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useMarket(orgId);

  // Filter NO-GO sprints and cluster by keyword frequency
  const noGoSprints = sprints.filter((sprint: any) => sprint.verdict?.aggregate_verdict === 'NO-GO');

  // Extract keywords from idea text
  const keywordFrequency = noGoSprints.reduce((acc: any, sprint: any) => {
    const words = sprint.idea.toLowerCase().split(/\s+/);
    words.forEach((word: string) => {
      if (word.length > 3) {
        acc[word] = (acc[word] || 0) + 1;
      }
    });
    return acc;
  }, {});

  // Group into themes by top keywords
  const topKeywords = Object.entries(keywordFrequency)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 10)
    .map((entry: any) => entry[0]);

  const themes = topKeywords.map((keyword: string) => {
    const matchingSprints = noGoSprints.filter((sprint: any) =>
      sprint.idea.toLowerCase().includes(keyword)
    );
    const avgCtr = matchingSprints.reduce((sum: number, s: any) => {
      const ctr = s.campaign?.angle_metrics?.blended_ctr || 0;
      return sum + ctr;
    }, 0) / matchingSprints.length;
    const avgGenomeScore = matchingSprints.reduce((sum: number, s: any) => {
      const score = s.genome?.composite_score || 0;
      return sum + score;
    }, 0) / matchingSprints.length;

    return {
      theme: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      noGoCount: matchingSprints.length,
      avgCtr: (avgCtr * 100).toFixed(2),
      avgGenomeScore: avgGenomeScore.toFixed(1),
    };
  }).sort((a: any, b: any) => b.noGoCount - a.noGoCount);

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">The Dead Zone: What the Market Keeps Rejecting</h3>
        <Skeleton className="h-64" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-4">The Dead Zone: What the Market Keeps Rejecting</h3>
      {themes.length === 0 ? (
        <p className="text-sm text-ink-3">No NO-GO verdict sprints found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium text-ink-3">Theme</th>
                <th className="text-right py-2 px-3 font-medium text-ink-3">NO-GO Count</th>
                <th className="text-right py-2 px-3 font-medium text-ink-3">Avg CTR</th>
                <th className="text-right py-2 px-3 font-medium text-ink-3">Avg Genome</th>
              </tr>
            </thead>
            <tbody>
              {themes.map((theme: any) => (
                <tr key={theme.theme} className="border-b border-border/50">
                  <td className="py-2 px-3">{theme.theme}</td>
                  <td className="text-right py-2 px-3 text-danger font-medium">{theme.noGoCount}</td>
                  <td className="text-right py-2 px-3">{theme.avgCtr}%</td>
                  <td className="text-right py-2 px-3">{theme.avgGenomeScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
