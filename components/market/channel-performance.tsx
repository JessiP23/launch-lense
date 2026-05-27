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

const CHANNELS = ['meta', 'google', 'tiktok', 'linkedin'];

function getCtrColor(ctr: number): string {
  if (ctr >= 2.5) return 'bg-green-500';
  if (ctr >= 1.5) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function ChannelPerformance({ orgId }: { orgId: string | null }) {
  const { sprints, angleResults, isLoading } = useMarket(orgId);

  // Calculate channel performance by vertical
  const channelData = sprints.reduce((acc: any, sprint: any) => {
    const vertical = classifyVertical(sprint.idea);
    if (!acc[vertical]) {
      acc[vertical] = { meta: { total: 0, sum: 0 }, google: { total: 0, sum: 0 }, tiktok: { total: 0, sum: 0 }, linkedin: { total: 0, sum: 0 } };
    }
    
    // Find matching angle results for this sprint
    const sprintAngles = angleResults.filter((ar: any) => ar.sprint_id === sprint.id);
    sprintAngles.forEach((ar: any) => {
      const channel = ar.channel;
      if (acc[vertical][channel]) {
        acc[vertical][channel].total++;
        acc[vertical][channel].sum += ar.ctr;
      }
    });
    return acc;
  }, {});

  const verticals = Object.keys(channelData).filter((v: string) => v !== 'other');

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">Channel Performance by Vertical</h3>
        <Skeleton className="h-64" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-4">Channel Performance by Vertical (Avg CTR)</h3>
      {verticals.length === 0 ? (
        <p className="text-sm text-ink-3">Insufficient data to show channel performance.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium text-ink-3">Vertical</th>
                {CHANNELS.map((channel) => (
                  <th key={channel} className="text-center py-2 px-3 font-medium text-ink-3 capitalize">{channel}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {verticals.map((vertical) => (
                <tr key={vertical} className="border-b border-border/50">
                  <td className="py-2 px-3 capitalize">{vertical}</td>
                  {CHANNELS.map((channel) => {
                    const data = channelData[vertical][channel];
                    const avgCtr = data.total > 0 ? (data.sum / data.total) * 100 : 0;
                    const colorClass = getCtrColor(avgCtr);
                    return (
                      <td key={channel} className="text-center py-2 px-3">
                        <div className="inline-flex items-center gap-2">
                          <div className={`w-3 h-3 rounded ${colorClass}`} />
                          <span className="font-medium">{avgCtr.toFixed(2)}%</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
