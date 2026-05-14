'use client';

// ─────────────────────────────────────────────────────────────────────────────
// CreativeApprovalWorkspace — drop-in section for the canvas creative panel.
//
// Layout (single-column, optimized for ~430px content width):
//   ┌────────────────────────────────┐
//   │  DEPLOY GATE BANNER            │
//   │  [ Angle A ][ Angle B ][ C ]   │  <- sticky angle tab strip
//   │  [meta][google][linkedin]…     │  <- channel chips (multi-channel only)
//   │  ┌────────────────────────────┐│
//   │  │   CreativeEditor (one)     ││  <- the active (angle, channel)
//   │  └────────────────────────────┘│
//   └────────────────────────────────┘
//
// One editor visible at a time keeps the panel scannable and avoids the
// "wall of forms" that made the previous container feel broken. Switching
// angles is instant because the hook caches all rows in memory.
//
// We also call `onSelectionChange` whenever the user switches angle or
// channel so the canvas node preview can mirror what the user is editing.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Angle, Platform } from '@/lib/agents/types';
import { useCreatives } from '@/hooks/use-creatives';
import { CreativeEditor } from './creative-editor';
import { DeployGate } from './deploy-gate';

const C = {
  ink: '#111110', muted: '#8C8880', border: '#E8E4DC',
  surface: '#FFFFFF', canvas: '#FAFAF8', faint: '#F3F0EB',
  go: '#0F8A4C',
};

export interface CreativeSelectionSnapshot {
  angle: Angle;
  channel: Platform;
  /** Resolved copy that's currently visible in the editor (server > fallback). */
  copy: {
    headline: string;
    primary_text: string;
    description: string;
    cta: string;
  };
}

interface Props {
  sprintId: string;
  angles: Angle[];
  activeChannels: Platform[];
  /** Pre-select an angle from the parent (e.g. from sprint.angles.selected_angle_id). */
  initialAngleId?: string;
  /** If the sprint already has a live campaign, render the LIVE banner. */
  liveCampaignId?: string | null;
  onActivated?: (campaignId: string) => void;
  /** Notifies parent when the user changes angle/channel — used to drive the
   *  live canvas node preview. */
  onSelectionChange?: (snap: CreativeSelectionSnapshot) => void;
}

export function CreativeApprovalWorkspace({
  sprintId, angles, activeChannels,
  initialAngleId, liveCampaignId, onActivated, onSelectionChange,
}: Props) {
  const controller = useCreatives(sprintId, { activeChannels });

  const channels: Platform[] = activeChannels.length ? activeChannels : ['meta'];
  const [activeChannel, setActiveChannel] = useState<Platform>(channels[0] ?? 'meta');
  const [activeAngleId, setActiveAngleId] = useState<string>(
    initialAngleId ?? angles[0]?.id ?? 'angle_A'
  );

  // If the active angle is no longer in the source set (rare; defensive)
  // we transparently fall back to the first available one. We derive this
  // instead of using a useEffect+setState pair (which triggers an extra
  // render and the react-hooks/set-state-in-effect lint).
  const activeAngle = useMemo(
    () => angles.find((a) => a.id === activeAngleId) ?? angles[0],
    [angles, activeAngleId]
  );

  // Bubble selection up to the parent so the canvas node preview tracks
  // what's in the panel. We MUST NOT depend on `onSelectionChange` itself
  // — callers typically pass an inline arrow that changes every render,
  // which would re-fire this effect on every parent state update and
  // cause an infinite setState loop. We store the callback in a ref and
  // only re-fire when the snapshot content actually changes.
  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => { onSelectionChangeRef.current = onSelectionChange; });

  const snapshot = useMemo(() => {
    if (!activeAngle) return null;
    const row = controller.byKey.get(`${activeAngle.id}::${activeChannel}`);
    const fb = fallbackFor(activeAngle, activeChannel);
    return {
      angle: activeAngle,
      channel: activeChannel,
      copy: {
        headline: row?.headline ?? fb.headline,
        primary_text: row?.primary_text ?? fb.primary_text,
        description: row?.description ?? fb.description ?? '',
        cta: row?.cta ?? fb.cta ?? '',
      },
    } as CreativeSelectionSnapshot;
  }, [activeAngle, activeChannel, controller.byKey]);

  // Coalesce identical snapshots into a single notification by comparing
  // the JSON projection — cheap given there are 3 angles × 4 channels max.
  const lastSnapshotKey = useRef<string | null>(null);
  useEffect(() => {
    if (!snapshot) return;
    const key = `${snapshot.angle.id}|${snapshot.channel}|${snapshot.copy.headline}|${snapshot.copy.primary_text}|${snapshot.copy.description}|${snapshot.copy.cta}`;
    if (key === lastSnapshotKey.current) return;
    lastSnapshotKey.current = key;
    onSelectionChangeRef.current?.(snapshot);
  }, [snapshot]);

  if (!angles.length || !activeAngle) {
    return (
      <div style={{ color: C.muted, fontSize: 13 }}>
        Approval workspace appears after AngleAgent generates copy.
      </div>
    );
  }

  // Status indicator per angle tab — small dot showing approval state.
  const statusDot = (angleId: string): { color: string; label: string } => {
    const rows = channels.map((ch) => controller.byKey.get(`${angleId}::${ch}`));
    if (rows.some((r) => r?.status === 'approved' && r?.policy_severity !== 'block'))
      return { color: C.go, label: 'approved' };
    if (rows.some((r) => r?.status === 'rejected'))
      return { color: '#DC2626', label: 'rejected' };
    if (rows.some((r) => r?.status === 'reviewing'))
      return { color: '#B17D00', label: 'reviewing' };
    return { color: C.border, label: 'draft' };
  };

  return (
    <div>
      <DeployGate
        controller={controller}
        liveCampaignId={liveCampaignId}
        onActivated={onActivated}
      />

      {/* Angle tab strip */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 10,
        borderBottom: `1px solid ${C.border}`,
        paddingBottom: 0,
      }}>
        {angles.map((angle) => {
          const active = angle.id === activeAngleId;
          const dot = statusDot(angle.id);
          return (
            <button key={angle.id}
              onClick={() => setActiveAngleId(angle.id)}
              title={`Status: ${dot.label}`}
              style={angleTabStyle(active)}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: dot.color,
                border: dot.color === C.border ? `1px solid ${C.border}` : undefined,
              }} />
              {angle.id.replace('angle_', 'Angle ')}
            </button>
          );
        })}
      </div>

      {/* Channel chips (only when multi-channel) */}
      {channels.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {channels.map((ch) => (
            <button key={ch}
              onClick={() => setActiveChannel(ch)}
              style={channelChipStyle(ch === activeChannel)}>
              {ch}
            </button>
          ))}
        </div>
      )}

      {/* Angle metadata strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 10, color: C.muted, fontSize: 11, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 0.4,
      }}>
        <span>{activeAngle.archetype}</span>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: C.border }} />
        <span>{activeAngle.emotional_lever}</span>
      </div>

      {controller.error && (
        <div style={errorBox}>{controller.error}</div>
      )}

      <CreativeEditor
        key={`${activeAngle.id}-${activeChannel}`}
        angle={activeAngle}
        platform={activeChannel}
        controller={controller}
        fallback={fallbackFor(activeAngle, activeChannel)}
      />
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

const angleTabStyle = (active: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 32, padding: '0 12px',
  border: 'none',
  borderBottom: `2px solid ${active ? C.ink : 'transparent'}`,
  borderRadius: 0,
  background: 'transparent',
  color: active ? C.ink : C.muted,
  fontSize: 12, fontWeight: 800,
  cursor: 'pointer',
  marginBottom: -1,
  transition: 'color 120ms ease, border-color 120ms ease',
});

const channelChipStyle = (active: boolean): CSSProperties => ({
  height: 26, padding: '0 10px',
  border: `1px solid ${active ? C.ink : C.border}`,
  borderRadius: 999,
  background: active ? C.ink : C.surface,
  color: active ? '#FFF' : C.muted,
  fontSize: 11, fontWeight: 800,
  textTransform: 'capitalize',
  cursor: 'pointer',
});

const errorBox: CSSProperties = {
  background: '#FCE3E3', border: '1px solid #F5B5B5', color: '#7A1A1A',
  padding: '8px 10px', borderRadius: 10, fontSize: 12, marginBottom: 12,
};
