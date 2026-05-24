'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

const VERDICT_COLORS: Record<string, string> = {
  GO: 'bg-success text-white',
  'NO-GO': 'bg-danger text-white',
  ITERATE: 'bg-warn text-white',
};

export function LiveVerdictFeed({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);

  const recentSprints = sprints.slice(0, 10);

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">Live Verdict Feed</h3>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-4">Live Verdict Feed</h3>
      <div className="space-y-3">
        {recentSprints.length === 0 ? (
          <p className="text-sm text-ink-3">No completed sprints yet.</p>
        ) : (
          recentSprints.map((sprint: any) => {
            const verdict = sprint.verdict?.aggregate_verdict || 'PENDING';
            const genomeScore = sprint.genome?.composite_score || 0;
            const ctr = sprint.campaign?.angle_metrics?.blended_ctr || 0;
            const idea = sprint.idea.length > 40 ? sprint.idea.slice(0, 40) + '...' : sprint.idea;
            const vertical = classifyVertical(sprint.idea);
            const timeAgo = formatTimeAgo(new Date(sprint.created_at));

            return (
              <div
                key={sprint.id}
                className="flex items-center justify-between p-3 rounded-lg bg-surface-2/50 border border-border/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium capitalize text-ink-3">{vertical}</span>
                    <Badge className={VERDICT_COLORS[verdict] || 'bg-gray-500'}>{verdict}</Badge>
                  </div>
                  <p className="text-sm text-ink-1 truncate">{idea}</p>
                </div>
                <div className="flex items-center gap-4 ml-4 text-xs text-ink-3">
                  <div className="text-right">
                    <div className="font-medium text-ink-2">{genomeScore.toFixed(0)}</div>
                    <div>Genome</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-ink-2">{(ctr * 100).toFixed(2)}%</div>
                    <div>CTR</div>
                  </div>
                  <div className="text-right w-16">{timeAgo}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

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
