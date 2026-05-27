'use client';

import { useAppStore } from '@/lib/store';
import { useMarket } from '@/hooks/use-market';
import { motion } from 'framer-motion';

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

export function ChannelVerticalHeatmap({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useMarket(orgId);

  if (isLoading) {
    return (
      <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          CHANNEL × VERTICAL HEATMAP
        </div>
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
          Loading...
        </div>
      </div>
    );
  }

  const channels = ['META', 'GOOGLE', 'TIKTOK', 'LINKEDIN'];
  const verticals = ['fintech', 'health', 'saas', 'ecommerce', 'consumer', 'b2b'];

  // Calculate CTR for each channel-vertical combination
  const heatmapData = verticals.map((vertical) => {
    const rowData: any = { vertical };
    channels.forEach((channel) => {
      const channelKey = channel.toLowerCase();
      const verticalSprints = sprints.filter((s: any) => classifyVertical(s.idea) === vertical);
      const channelSprints = verticalSprints.filter((s: any) => s.campaign?.angle_metrics?.[`${channelKey}_ctr`] > 0);
      const avgCtr = channelSprints.length > 0
        ? channelSprints.reduce((sum: number, s: any) => sum + (s.campaign?.angle_metrics?.[`${channelKey}_ctr`] || 0), 0) / channelSprints.length
        : 0;
      rowData[channel] = avgCtr * 100;
    });
    return rowData;
  });

  const maxCtr = Math.max(...heatmapData.flatMap((row: any) => channels.map((ch) => row[ch] || 0)));

  const getColor = (value: number) => {
    if (value === 0) return 'var(--surface-elevated)';
    const intensity = value / maxCtr;
    const r = Math.round(59 + (59 - 59) * intensity);
    const g = Math.round(130 + (255 - 130) * intensity);
    const b = Math.round(246 + (148 - 246) * intensity);
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}
    >
      <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        CHANNEL × VERTICAL HEATMAP
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Header row */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 80, fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }} />
          {channels.map((channel) => (
            <div key={channel} style={{ flex: 1, fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'center' }}>
              {channel}
            </div>
          ))}
        </div>
        {/* Data rows */}
        {heatmapData.map((row: any, rowIndex: number) => (
          <div key={row.vertical} style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 80, fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'capitalize', color: 'var(--text-primary)' }}>
              {row.vertical}
            </div>
            {channels.map((channel) => {
              const value = row[channel] || 0;
              return (
                <motion.div
                  key={channel}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: rowIndex * 0.05 }}
                  style={{
                    flex: 1,
                    height: '32px',
                    background: getColor(value),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: value > 1 ? 'var(--surface-primary)' : 'var(--text-tertiary)',
                  }}
                >
                  {value > 0 ? value.toFixed(2) + '%' : '-'}
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
