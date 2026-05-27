'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
import { motion, AnimatePresence } from 'framer-motion';

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  const days = Math.floor(seconds / (60 * 60 * 24));

  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

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

function getChannels(sprint: any): string[] {
  const channels: string[] = [];
  if (sprint.campaign?.angle_metrics?.meta_ctr > 0) channels.push('META');
  if (sprint.campaign?.angle_metrics?.google_ctr > 0) channels.push('GOOGLE');
  if (sprint.campaign?.angle_metrics?.tiktok_ctr > 0) channels.push('TIKTOK');
  if (sprint.campaign?.angle_metrics?.linkedin_ctr > 0) channels.push('LINKEDIN');
  return channels;
}

export function LiveVerdictFeed({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);

  const recentSprints = sprints.slice(0, 20);

  if (isLoading) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          LIVE VERDICT FEED
        </div>
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 16px' }}>
      <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        LIVE VERDICT FEED
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {recentSprints.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            No completed sprints yet.
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {recentSprints.map((sprint: any, index: number) => {
              const verdict = sprint.verdict?.aggregate_verdict || 'PENDING';
              const genomeScore = sprint.genome?.composite_score || 0;
              const ctr = sprint.campaign?.angle_metrics?.blended_ctr || 0;
              const vertical = classifyVertical(sprint.idea);
              const timeAgo = formatTimeAgo(new Date(sprint.created_at));
              const channels = getChannels(sprint);
              const channelString = channels.length > 0 ? channels.join(' + ') : 'N/A';

              const verdictColor = verdict === 'GO' ? 'var(--signal-go)' : verdict === 'NO-GO' ? 'var(--signal-no-go)' : 'var(--signal-iterate)';
              const verdictBg = verdict === 'GO' ? '#00FF9410' : verdict === 'NO-GO' ? '#FF3B5C10' : '#FFB80010';

              return (
                <motion.div
                  key={sprint.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--surface-border)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-elevated)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '3px 6px',
                        borderRadius: 2,
                        background: verdictBg,
                        color: verdictColor,
                        border: `1px solid ${verdictColor}`,
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {verdict}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 500,
                        padding: '3px 6px',
                        borderRadius: 2,
                        background: 'var(--surface-elevated)',
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {vertical}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {vertical.charAt(0).toUpperCase() + vertical.slice(1)} idea · {channelString}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                    <div style={{ color: 'var(--text-primary)' }}>{genomeScore.toFixed(0)}</div>
                    <div style={{ color: 'var(--text-primary)' }}>{(ctr * 100).toFixed(2)}%</div>
                    <div>{timeAgo}</div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
