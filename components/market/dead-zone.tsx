'use client';

import { useMarket } from '@/hooks/use-market';
import { motion } from 'framer-motion';

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
      <div style={{ padding: '24px 16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          THE DEAD ZONE
        </div>
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ padding: '24px 16px' }}
    >
      <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        THE DEAD ZONE
      </div>
      {themes.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          No NO-GO verdict sprints found.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  THEME
                </th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  NO-GO COUNT
                </th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  AVG CTR
                </th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  AVG GENOME
                </th>
              </tr>
            </thead>
            <tbody>
              {themes.map((theme: any) => (
                <tr
                  key={theme.theme}
                  style={{ borderBottom: '1px solid var(--surface-border)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-elevated)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{theme.theme}</td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--signal-no-go)', fontWeight: 600 }}>
                    {theme.noGoCount}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {theme.avgCtr}%
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {theme.avgGenomeScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
