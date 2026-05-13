'use client';

// ─────────────────────────────────────────────────────────────────────────────
// CreativeApprovalWorkspace — drop-in section for the canvas creative panel.
//
// Renders, top-down:
//   1. DeployGate banner (driven by useCreatives.approvalState).
//   2. One CreativeEditor card per angle for the selected platform.
//
// This component owns the hook so all editors share a single autosave
// queue + cache. The rest of the canvas can stay agnostic.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type CSSProperties } from 'react';
import type { Angle, Platform } from '@/lib/agents/types';
import { useCreatives } from '@/hooks/use-creatives';
import { CreativeEditor } from './creative-editor';
import { DeployGate } from './deploy-gate';

const C = {
  ink: '#111110', muted: '#8C8880', border: '#E8E4DC',
  surface: '#FFFFFF', canvas: '#FAFAF8', faint: '#F3F0EB',
};

interface Props {
  sprintId: string;
  angles: Angle[];
  /** Channels the sprint is targeting; gates the deploy banner. */
  activeChannels: Platform[];
  /** Optional brand label shown in previews. */
  brandName?: string;
  /** If the sprint already has a live campaign, render the LIVE banner. */
  liveCampaignId?: string | null;
  onActivated?: (campaignId: string) => void;
}

export function CreativeApprovalWorkspace({
  sprintId, angles, activeChannels, brandName, liveCampaignId, onActivated,
}: Props) {
  const controller = useCreatives(sprintId, { activeChannels });

  // Channel selector — meta is the only channel the launcher actually
  // deploys today, but we keep the others editable for parity.
  const channels = activeChannels.length ? activeChannels : (['meta'] as Platform[]);
  const [activeChannel, setActiveChannel] = useState<Platform>(channels[0] ?? 'meta');

  if (!angles.length) {
    return (
      <div style={{ color: C.muted, fontSize: 13 }}>
        Approval workspace appears after AngleAgent generates copy.
      </div>
    );
  }

  return (
    <div>
      <DeployGate
        controller={controller}
        liveCampaignId={liveCampaignId}
        onActivated={onActivated}
      />

      {/* Channel switcher (only when more than one is active) */}
      {channels.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {channels.map((ch) => (
            <button key={ch}
              onClick={() => setActiveChannel(ch)}
              style={tabStyle(ch === activeChannel)}>
              {ch}
            </button>
          ))}
        </div>
      )}

      {controller.error && (
        <div style={errorBox}>{controller.error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {angles.map((angle) => {
          const fallback = fallbackFor(angle, activeChannel);
          return (
            <CreativeEditor
              key={`${angle.id}-${activeChannel}`}
              sprintId={sprintId}
              angle={angle}
              platform={activeChannel}
              controller={controller}
              fallback={fallback}
              brandName={brandName}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────

function fallbackFor(angle: Angle, platform: Platform) {
  switch (platform) {
    case 'meta':
      return {
        headline: angle.copy.meta.headline,
        primary_text: angle.copy.meta.body,
        cta: angle.cta || 'LEARN_MORE',
      };
    case 'google':
      return {
        headline: angle.copy.google.headline1,
        primary_text: angle.copy.google.description,
        description: angle.copy.google.headline2,
        cta: angle.cta,
      };
    case 'linkedin':
      return {
        headline: angle.copy.linkedin.headline,
        primary_text: angle.copy.linkedin.body,
        description: angle.copy.linkedin.intro,
        cta: angle.cta,
      };
    case 'tiktok':
      return {
        headline: angle.copy.tiktok.overlay,
        primary_text: angle.copy.tiktok.hook,
        cta: angle.cta,
      };
  }
}

const tabStyle = (active: boolean): CSSProperties => ({
  height: 30, padding: '0 12px',
  border: `1px solid ${active ? C.ink : C.border}`,
  borderRadius: 8,
  background: active ? C.ink : C.surface,
  color: active ? '#FFF' : C.muted,
  fontSize: 12, fontWeight: 800,
  textTransform: 'capitalize', cursor: 'pointer',
});

const errorBox: CSSProperties = {
  background: '#FCE3E3', border: '1px solid #F5B5B5', color: '#7A1A1A',
  padding: '8px 10px', borderRadius: 10, fontSize: 12, marginBottom: 12,
};
