'use client';

import { useIntelligence } from '@/hooks/use-intelligence';

const C = { ink: '#111110', muted: '#8C8880', border: '#E8E4DC', surface: '#FFFFFF', faint: '#F3F0EB' };

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  const days = Math.floor(seconds / (60 * 60 * 24));

  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

const VERDICT_COLORS: Record<string, { bg: string; text: string }> = {
  GO: { bg: '#F0FDF4', text: '#059669' },
  'NO-GO': { bg: '#FEF2F2', text: '#DC2626' },
  ITERATE: { bg: '#FFFBEB', text: '#D97706' },
};

export function LiveVerdictFeed({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);

  const recentSprints = sprints.slice(0, 10);

  if (isLoading) {
    return (
      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 16, color: C.ink }}>Live Verdict Feed</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 64, background: C.faint, borderRadius: 8 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 16, color: C.ink }}>Live Verdict Feed</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {recentSprints.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: C.muted }}>No completed sprints yet.</p>
        ) : (
          recentSprints.map((sprint: any) => {
            const verdict = sprint.verdict?.aggregate_verdict || 'PENDING';
            const genomeScore = sprint.genome?.composite_score || 0;
            const ctr = sprint.campaign?.angle_metrics?.blended_ctr || 0;
            const idea = sprint.idea.length > 40 ? sprint.idea.slice(0, 40) + '...' : sprint.idea;
            const vertical = classifyVertical(sprint.idea);
            const timeAgo = formatTimeAgo(new Date(sprint.created_at));
            const colors = VERDICT_COLORS[verdict] || { bg: C.faint, text: C.muted };

            return (
              <div
                key={sprint.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 12,
                  borderRadius: 8,
                  background: C.faint,
                  border: `1px solid ${C.border}50`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'capitalize', color: C.muted }}>{vertical}</span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: colors.bg,
                      color: colors.text,
                    }}>{verdict}</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{idea}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 16, fontSize: '0.75rem', color: C.muted }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: C.ink }}>{genomeScore.toFixed(0)}</div>
                    <div>Genome</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: C.ink }}>{(ctr * 100).toFixed(2)}%</div>
                    <div>CTR</div>
                  </div>
                  <div style={{ textAlign: 'right', width: 64 }}>{timeAgo}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
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
