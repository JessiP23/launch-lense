'use client';

import { useMarket } from '@/hooks/use-market';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function TopWinningAngles({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useMarket(orgId);

  // Filter GO verdict sprints from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentGoSprints = sprints.filter((sprint: any) => {
    const verdict = sprint.verdict?.aggregate_verdict;
    const createdAt = new Date(sprint.created_at);
    return verdict === 'GO' && createdAt >= thirtyDaysAgo;
  });

  // Extract winning angle archetypes from angles data
  const angleArchetypes = recentGoSprints.reduce((acc: any, sprint: any) => {
    const angles = sprint.angles || {};
    Object.entries(angles).forEach(([angleId, angleData]: [string, any]) => {
      const archetype = angleData?.archetype;
      if (archetype) {
        if (!acc[archetype]) {
          acc[archetype] = { count: 0, totalCtr: 0, totalCpc: 0, headlines: [] };
        }
        acc[archetype].count++;
        const ctr = sprint.campaign?.angle_metrics?.[angleId]?.ctr || 0;
        const cpc = sprint.campaign?.angle_metrics?.[angleId]?.cpc_cents || 0;
        acc[archetype].totalCtr += ctr;
        acc[archetype].totalCpc += cpc;
        acc[archetype].headlines.push({ ctr, headline: angleData?.headline || '' });
      }
    });
    return acc;
  }, {});

  const topAngles = Object.entries(angleArchetypes)
    .map(([archetype, data]: [string, any]) => ({
      archetype,
      winCount: data.count,
      avgCtr: data.count > 0 ? (data.totalCtr / data.count) * 100 : 0,
      avgCpc: data.count > 0 ? data.totalCpc / data.count / 100 : 0,
      exampleHeadline: data.headlines.sort((a: any, b: any) => b.ctr - a.ctr)[0]?.headline || '',
    }))
    .sort((a: any, b: any) => b.winCount - a.winCount)
    .slice(0, 5);

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">Top Winning Angles This Month</h3>
        <Skeleton className="h-64" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-4">Top Winning Angles This Month</h3>
      {topAngles.length === 0 ? (
        <p className="text-sm text-ink-3">No GO verdict sprints in the last 30 days.</p>
      ) : (
        <div className="space-y-3">
          {topAngles.map((angle: any) => (
            <div key={angle.archetype} className="flex items-center justify-between p-3 rounded-lg bg-surface-2/50 border border-border/50">
              <div className="flex-1">
                <div className="font-medium text-ink-1 capitalize">{angle.archetype}</div>
                <div className="text-xs text-ink-3 truncate">{angle.exampleHeadline}</div>
              </div>
              <div className="flex items-center gap-4 text-xs text-ink-3">
                <div className="text-right">
                  <div className="font-medium text-ink-2">{angle.winCount}</div>
                  <div>Wins</div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-ink-2">{angle.avgCtr.toFixed(2)}%</div>
                  <div>Avg CTR</div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-ink-2">${angle.avgCpc.toFixed(2)}</div>
                  <div>Avg CPC</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
