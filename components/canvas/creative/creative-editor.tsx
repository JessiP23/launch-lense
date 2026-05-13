'use client';

// ─────────────────────────────────────────────────────────────────────────────
// CreativeEditor — single (angle, platform) approval card.
//
// Responsibilities:
//   - Inline-edit the headline, primary text, description, CTA.
//   - Show live Meta-style preview (Feed / Story / Reel switcher).
//   - Drive status transitions (Approve / Reject / Reopen / Regenerate)
//     through the useCreatives hook.
//   - Render policy issues from the most recent persisted scan.
//
// State strategy:
//   - The hook holds the canonical row. We read directly from it so edits
//     made elsewhere (eg. regenerate response) flow in automatically.
//   - We only keep local state for ephemeral UI (rejection-reason draft,
//     active preview placement, regenerate-direction draft).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type CSSProperties } from 'react';
import { Loader2 } from 'lucide-react';
import type {
  Angle,
  CreativeStatus,
  Platform,
  PolicyIssue,
  PolicySeverity,
} from '@/lib/agents/types';
import {
  MetaPreviewCard,
  type MetaPlacement,
  type MetaPreviewContent,
} from './meta-previews';
import type { useCreatives } from '@/hooks/use-creatives';

const C = {
  ink: '#111110', muted: '#8C8880', border: '#E8E4DC',
  surface: '#FFFFFF', canvas: '#FAFAF8', faint: '#F3F0EB',
  go: '#0F8A4C', warn: '#B17D00', stop: '#DC2626',
};

interface Limits { headline: number; body: number; description: number }
const LIMITS_BY_PLATFORM: Record<Platform, Limits> = {
  meta: { headline: 40, body: 125, description: 30 },
  google: { headline: 30, body: 90, description: 30 },
  linkedin: { headline: 25, body: 150, description: 70 },
  tiktok: { headline: 80, body: 100, description: 80 },
};

// ── Status pill ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<CreativeStatus, { bg: string; fg: string; label: string }> = {
  draft:     { bg: C.faint,    fg: C.muted, label: 'Draft' },
  reviewing: { bg: '#FFF7DB',  fg: '#8A6B00', label: 'Reviewing' },
  approved:  { bg: '#DFF6E7',  fg: C.go,     label: 'Approved' },
  rejected:  { bg: '#FCE3E3',  fg: C.stop,   label: 'Rejected' },
  deploying: { bg: '#E5EEFF',  fg: '#1F5BD0', label: 'Deploying' },
  deployed:  { bg: '#D9F1E2',  fg: C.go,     label: 'Live' },
  failed:    { bg: '#FCE3E3',  fg: C.stop,   label: 'Failed' },
};

function StatusPill({ status }: { status: CreativeStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 22, padding: '0 10px', borderRadius: 999,
      background: s.bg, color: s.fg,
      fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4,
    }}>{s.label}</span>
  );
}

// ── Policy summary ────────────────────────────────────────────────────────

function PolicyBlock({ severity, issues }: { severity: PolicySeverity | null; issues: PolicyIssue[] | null }) {
  if (!severity) {
    return (
      <div style={{ fontSize: 12, color: C.muted }}>
        Not scanned yet. Run a policy scan before approving.
      </div>
    );
  }
  const color = severity === 'block' ? C.stop : severity === 'warn' ? C.warn : C.go;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: color,
        }} />
        <span style={{ fontSize: 12, fontWeight: 800, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Policy: {severity}
        </span>
      </div>
      {issues && issues.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
          {issues.map((iss, i) => (
            <li key={`${iss.code}-${i}`}>
              <strong style={{ color: iss.severity === 'block' ? C.stop : iss.severity === 'warn' ? C.warn : C.ink }}>
                {iss.code}
              </strong>
              {' — '}{iss.message}
              {iss.field ? <span style={{ color: C.muted }}> ({iss.field})</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────

interface Props {
  /** Currently unused at the editor level (the controller already knows it),
   *  but kept on the props for future per-card actions that need it. */
  sprintId?: string;
  angle: Angle;
  platform: Platform;
  /** The hook output, hoisted by the parent so siblings share cache. */
  controller: ReturnType<typeof useCreatives>;
  /** Fallback copy used when no sprint_creatives row exists yet. */
  fallback: { headline: string; primary_text: string; description?: string; cta?: string };
  /** Optional brand name for previews. */
  brandName?: string;
}

export function CreativeEditor({
  angle, platform, controller, fallback, brandName,
}: Props) {
  const row = controller.byKey.get(`${angle.id}::${platform}`);
  const status: CreativeStatus = row?.status ?? 'draft';
  const limits = LIMITS_BY_PLATFORM[platform];

  // Local UI state — not persisted.
  const [placement, setPlacement] = useState<MetaPlacement>('feed');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [direction, setDirection] = useState('');

  const headline = row?.headline ?? fallback.headline;
  const primaryText = row?.primary_text ?? fallback.primary_text;
  const description = row?.description ?? fallback.description ?? '';
  const cta = row?.cta ?? fallback.cta ?? 'LEARN_MORE';

  const saving = controller.isSaving(angle.id, platform);
  const busy = controller.isBusy(angle.id, platform);
  const editLocked = status === 'deploying' || status === 'deployed';

  const previewContent: MetaPreviewContent = {
    brandName: brandName ?? 'Your Brand',
    headline, primaryText, description: description || null, cta,
    imageUrl: row?.image_url ?? null,
    videoUrl: row?.video_url ?? null,
  };

  const handleApprove = async () => {
    try {
      await controller.approve(angle.id, platform);
    } catch (err) {
      // Surface inline — alert is fine for v1; the issues themselves are already persisted.
      alert(err instanceof Error ? err.message : 'Approve failed');
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    try {
      await controller.reject(angle.id, platform, rejectionReason.trim());
      setShowRejectBox(false);
      setRejectionReason('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reject failed');
    }
  };

  const handleReopen = async () => {
    try { await controller.reopen(angle.id, platform); }
    catch (err) { alert(err instanceof Error ? err.message : 'Reopen failed'); }
  };

  const handleRegenerate = async () => {
    try {
      await controller.regenerate(angle.id, platform, direction.trim() || undefined);
      setDirection('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Regenerate failed');
    }
  };

  const handleScan = async () => {
    try { await controller.scan(angle.id, platform); }
    catch (err) { alert(err instanceof Error ? err.message : 'Scan failed'); }
  };

  // Strip <input>/<textarea> chrome to keep the panel compact.
  const inputStyle = (overLimit: boolean): CSSProperties => ({
    width: '100%', boxSizing: 'border-box',
    border: `1px solid ${overLimit ? C.stop : C.border}`,
    borderRadius: 10, background: C.canvas, color: C.ink,
    padding: '9px 10px', fontSize: '0.8125rem', outline: 'none',
    fontFamily: 'inherit',
  });

  const fieldRow = (label: string, value: string, max: number, key: 'headline' | 'primary_text' | 'description' | 'cta', multiline = false) => {
    const len = value.length;
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
          <span style={{ color: len > max ? C.stop : C.muted, fontSize: 11, fontFamily: 'monospace' }}>{len}/{max}</span>
        </div>
        {multiline ? (
          <textarea
            value={value}
            disabled={editLocked}
            rows={3}
            onChange={(e) => controller.editField(angle.id, platform, key, e.target.value)}
            style={{ ...inputStyle(len > max), resize: 'none' }}
          />
        ) : (
          <input
            value={value}
            disabled={editLocked}
            onChange={(e) => controller.editField(angle.id, platform, key, e.target.value)}
            style={inputStyle(len > max)}
          />
        )}
      </div>
    );
  };

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: 14, display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) 220px',
      gap: 14,
    }}>
      {/* ── Editor column ─────────────────────────────────────── */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>
            {angle.id.replace('angle_', 'Angle ')} · {angle.archetype}
          </span>
          <StatusPill status={status} />
          {saving && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: C.muted, fontSize: 11 }}>
              <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Saving…
            </span>
          )}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4 }}>
            {platform}
          </span>
        </div>

        {fieldRow('Headline', headline, limits.headline, 'headline')}
        {fieldRow('Primary text', primaryText, limits.body, 'primary_text', true)}
        {fieldRow('Description', description, limits.description, 'description')}
        {fieldRow('CTA', cta, 40, 'cta')}

        {/* Policy + actions */}
        <div style={{
          marginTop: 8, padding: 10,
          background: C.canvas, borderRadius: 10,
        }}>
          <PolicyBlock severity={row?.policy_severity ?? null} issues={row?.policy_issues ?? null} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <button onClick={handleScan} disabled={busy} style={btnSecondary(busy)}>
              {busy ? 'Working…' : 'Scan'}
            </button>
            {(status === 'draft' || status === 'reviewing' || status === 'rejected' || status === 'failed') && (
              <button onClick={handleApprove} disabled={busy || row?.policy_severity === 'block'} style={btnPrimary(busy)}>
                Approve
              </button>
            )}
            {(status === 'reviewing' || status === 'draft') && (
              <button onClick={() => setShowRejectBox((v) => !v)} disabled={busy} style={btnDanger(busy)}>
                Reject
              </button>
            )}
            {(status === 'approved' || status === 'rejected') && (
              <button onClick={handleReopen} disabled={busy} style={btnSecondary(busy)}>
                Reopen
              </button>
            )}
          </div>

          {showRejectBox && (
            <div style={{ marginTop: 10 }}>
              <textarea
                placeholder="Why are you rejecting this? (required)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
                style={{ ...inputStyle(false), resize: 'none' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <button onClick={handleReject} disabled={!rejectionReason.trim() || busy} style={btnDanger(busy)}>
                  Confirm reject
                </button>
              </div>
            </div>
          )}

          {/* Regenerate */}
          {!editLocked && (
            <div style={{
              marginTop: 12, paddingTop: 10,
              borderTop: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Regenerate copy
              </span>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                  placeholder="Optional direction (e.g. 'more urgent')"
                  style={{ ...inputStyle(false), flex: 1 }}
                />
                <button onClick={handleRegenerate} disabled={busy} style={btnPrimary(busy)}>
                  {busy ? '…' : 'Regenerate'}
                </button>
              </div>
            </div>
          )}

          {row?.rejected_reason && status === 'rejected' && (
            <div style={{ marginTop: 10, fontSize: 12, color: C.stop }}>
              <strong>Rejected:</strong> {row.rejected_reason}
            </div>
          )}
        </div>
      </div>

      {/* ── Preview column ────────────────────────────────────── */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {(['feed', 'story', 'reel'] as MetaPlacement[]).map((p) => (
            <button key={p}
              onClick={() => setPlacement(p)}
              style={{
                flex: 1, height: 26, padding: 0,
                border: `1px solid ${placement === p ? C.ink : C.border}`,
                borderRadius: 8,
                background: placement === p ? C.ink : C.surface,
                color: placement === p ? '#FFF' : C.muted,
                fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                cursor: 'pointer',
              }}>{p}</button>
          ))}
        </div>
        <MetaPreviewCard placement={placement} content={previewContent} />
      </div>
    </div>
  );
}

// ── Button styles ─────────────────────────────────────────────────────────

const baseBtn: CSSProperties = {
  height: 30, padding: '0 12px',
  border: 'none', borderRadius: 8,
  fontSize: 12, fontWeight: 800,
  cursor: 'pointer',
};
const btnPrimary = (disabled: boolean): CSSProperties => ({
  ...baseBtn, background: C.ink, color: '#FFF',
  opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer',
});
const btnSecondary = (disabled: boolean): CSSProperties => ({
  ...baseBtn, background: C.faint, color: C.ink,
  opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer',
});
const btnDanger = (disabled: boolean): CSSProperties => ({
  ...baseBtn, background: C.stop, color: '#FFF',
  opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer',
});

// We can't easily inject a stylesheet from here for the spinner animation;
// the parent page already imports framer-motion which supplies its own
// keyframes. As a fallback we rely on Lucide's default Loader2 + the
// CSS keyframe `@keyframes spin` which Tailwind's preflight provides.
