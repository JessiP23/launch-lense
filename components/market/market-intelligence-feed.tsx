'use client';

import { useAppStore } from '@/lib/store';
import { TopWinningAngles } from './top-winning-angles';
import { VerticalMomentum } from './vertical-momentum';
import { CompetitiveDensity } from './competitive-density';
import { DeadZone } from './dead-zone';
import { ChannelPerformance } from './channel-performance';

export function MarketIntelligenceFeed() {
  const orgId = useAppStore((s) => s.orgId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Market Intelligence</h1>
      </div>

      <TopWinningAngles orgId={orgId} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VerticalMomentum orgId={orgId} />
        <CompetitiveDensity orgId={orgId} />
      </div>

      <DeadZone orgId={orgId} />

      <ChannelPerformance orgId={orgId} />
    </div>
  );
}
