'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SprintSignalRow } from '@/lib/signal-fabric';

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  const days = Math.floor(seconds / (60 * 60 * 24));

  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function LiveSignalFeed({ orgId }: { orgId: string | null }) {
  const [signals, setSignals] = useState<SprintSignalRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSignals() {
      try {
        const { getRecentSprintSignals } = await import('@/lib/signal-fabric');
        const recentSignals = await getRecentSprintSignals(20);
        setSignals(recentSignals);
      } catch (err) {
        console.error('Failed to fetch sprint signals:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSignals();
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          LIVE SIGNAL FEED
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
        LIVE SIGNAL FEED
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {signals.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            No sprint signals recorded yet. Complete sprints will appear here.
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {signals.map((signal, index) => {
              const verdictColor = signal.verdict === 'GO' ? 'var(--signal-go)' : signal.verdict === 'NO-GO' ? 'var(--signal-no-go)' : 'var(--signal-iterate)';
              const verdictBg = signal.verdict === 'GO' ? '#00FF9410' : signal.verdict === 'NO-GO' ? '#FF3B5C10' : '#FFB80010';
              const timeAgo = formatTimeAgo(new Date(signal.created_at));
              const ctrPct = signal.ctr ? (signal.ctr * 100).toFixed(2) : 'N/A';

              return (
                <motion.div
                  key={signal.sprint_id}
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
                      {signal.verdict}
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
                      {signal.vertical}
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
                      {signal.channel}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {signal.sprint_id.slice(0, 8)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                    <div style={{ color: 'var(--text-primary)' }}>{ctrPct}%</div>
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
