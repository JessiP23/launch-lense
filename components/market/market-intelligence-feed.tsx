'use client';

import { useAppStore } from '@/lib/store';
import { MarketStats } from './market-stats';
import { VerticalMomentum } from './vertical-momentum';
import { WinningAngleArchetypes } from './winning-angle-archetypes';
import { ChannelVerticalHeatmap } from './channel-vertical-heatmap';
import { DeadZone } from './dead-zone';

export function MarketIntelligenceFeed() {
  const orgId = useAppStore((s) => s.orgId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <MarketStats orgId={orgId} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0 }}>
        <VerticalMomentum orgId={orgId} />
        <WinningAngleArchetypes orgId={orgId} />
      </div>

      <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '24px' }}>
        <ChannelVerticalHeatmap orgId={orgId} />
      </div>

      <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '24px' }}>
        <DeadZone orgId={orgId} />
      </div>
    </div>
  );
}
