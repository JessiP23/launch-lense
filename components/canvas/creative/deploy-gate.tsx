'use client';

// ─────────────────────────────────────────────────────────────────────────────
// DeployGate — top-of-panel banner that drives the launch action.
//
// Three states:
//   1. INCOMPLETE — at least one channel still missing an approved creative.
//      Blocks the launch button.
//   2. READY — every active channel has an approved + policy-clean creative.
//      Surfaces the "Launch live ads" button which calls /campaign/activate.
//   3. LIVE — campaign already activated (parent supplies `liveCampaignId`).
//
// We deliberately keep the actual activation call inside the controller
// (useCreatives.activateCampaign) so the loading + error semantics stay
// in one place.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type CSSProperties } from 'react';
import type { Platform } from '@/lib/agents/types';
import type { useCreatives } from '@/hooks/use-creatives';

const C = {
  ink: '#111110', muted: '#8C8880', border: '#E8E4DC',
  surface: '#FFFFFF', canvas: '#FAFAF8', faint: '#F3F0EB',
  go: '#0F8A4C', warn: '#B17D00', stop: '#DC2626',
};

interface Props {
  controller: ReturnType<typeof useCreatives>;
  /** Set when /campaign/activate has succeeded so we render the live state. */
  liveCampaignId?: string | null;
  /** Optional callback after a successful activation (e.g. refetch sprint). */
  onActivated?: (campaignId: string) => void;
}

export function DeployGate({ controller, liveCampaignId, onActivated }: Props) {
  const { ok, missing, channels } = controller.approvalState;
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeNow, setActiveNow] = useState<string | null>(liveCampaignId ?? null);

  const handleActivate = async () => {
    setActivating(true);
    setError(null);
    try {
      const res = await controller.activateCampaign();
      const id = res?.campaign_id ?? null;
      if (id) {
        setActiveNow(id);
        onActivated?.(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setActivating(false);
    }
  };

  // ── LIVE state ─────────────────────────────────────────────────────────
  if (activeNow) {
    return (
      <div style={banner('live')}>
        <span style={dot(C.go)} />
        <strong style={{ color: C.ink }}>Campaign is live</strong>
        <span style={{ color: C.muted, fontSize: 12 }}>
          Meta campaign {activeNow.slice(0, 12)}…
        </span>
      </div>
    );
  }

  // ── READY state ────────────────────────────────────────────────────────
  if (ok) {
    return (
      <div style={banner('ready')}>
        <span style={dot(C.go)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>Ready to launch</div>
          <div style={{ fontSize: 12, color: C.muted }}>
            All active channels have an approved, policy-clean creative.
          </div>
        </div>
        <button onClick={handleActivate} disabled={activating} style={launchBtn(activating)}>
          {activating ? 'Activating…' : 'Launch live ads'}
        </button>
        {error && <div style={{ marginTop: 6, color: C.stop, fontSize: 12, width: '100%' }}>{error}</div>}
      </div>
    );
  }

  // ── INCOMPLETE state ───────────────────────────────────────────────────
  return (
    <div style={banner('block')}>
      <span style={dot(C.warn)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>Approval required</div>
        <div style={{ fontSize: 12, color: C.muted }}>
          {missing.length === channels.length && controller.creatives.length === 0
            ? 'No creatives drafted yet. Edit and approve at least one creative per channel.'
            : `Missing approved creative on: ${(missing as Platform[]).join(', ') || 'no active channel'}.`}
        </div>
      </div>
      <button disabled style={launchBtn(true)}>Launch live ads</button>
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────

const banner = (variant: 'ready' | 'block' | 'live'): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '12px 14px',
  borderRadius: 12,
  background:
    variant === 'ready' ? '#EAF7EF' :
    variant === 'live'  ? C.faint :
    '#FFF7DB',
  border: `1px solid ${variant === 'ready' ? '#BCE3CC' : variant === 'live' ? C.border : '#F0DDA0'}`,
  marginBottom: 14,
  flexWrap: 'wrap',
});

const dot = (color: string): CSSProperties => ({
  width: 10, height: 10, borderRadius: '50%', background: color, flex: '0 0 auto',
});

const launchBtn = (disabled: boolean): CSSProperties => ({
  height: 36, padding: '0 16px',
  border: 'none', borderRadius: 10,
  background: disabled ? C.faint : C.ink,
  color: disabled ? C.muted : '#FFF',
  fontSize: 13, fontWeight: 800,
  cursor: disabled ? 'default' : 'pointer',
});
