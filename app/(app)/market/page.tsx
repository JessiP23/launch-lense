'use client';

import { MarketIntelligenceFeed } from '@/components/market/market-intelligence-feed';

export default function MarketPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-primary)', padding: '16px' }}>
      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
            Market Intelligence
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Track market trends, vertical momentum, and competitive density across the LaunchLense ecosystem.
          </p>
        </div>
        <MarketIntelligenceFeed />
      </div>
    </div>
  );
}
