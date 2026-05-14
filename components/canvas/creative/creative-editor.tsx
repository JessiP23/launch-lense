'use client';

// ─────────────────────────────────────────────────────────────────────────────
// CreativeEditor — single (angle, platform) approval card.
//
// Single-column form-only layout. The live ad preview is rendered by the
// canvas node itself — we do NOT duplicate it inside the panel. The panel
// is purely for editing copy + driving approval status:
//
//   ┌────────────────────────────────┐
//   │ status pill · saving indicator │
//   │ headline ____________          │
//   │ primary  ____________          │
//   │ desc     ____________          │
//   │ cta      ____________          │
//   │ policy block                   │
//   │ [Scan] [Approve] [Reject]      │
//   │ regenerate row                 │
//   └────────────────────────────────┘
//
// State strategy:
//   - The hook holds the canonical row. We read it directly so edits made
//     elsewhere (regenerate, scan) flow in automatically.
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
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Not scanned yet. Run a policy scan before approving.
      </div>
    );
  }
  const color = severity === 'block' ? C.stop : severity === 'warn' ? C.warn : C.go;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.4 }}>
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

// ── Field renderer ────────────────────────────────────────────────────────

function FieldRow({
  label, value, max, onChange, multiline, disabled,
}: {
  label: string;
  value: string;
  max: number;
  onChange: (next: string) => void;
  multiline?: boolean;
  disabled?: boolean;
}) {
  const len = value.length;
  const overLimit = len > max;
  const inputStyle: CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    border: `1px solid ${overLimit ? C.stop : C.border}`,
    borderRadius: 10, background: C.canvas, color: C.ink,
    padding: '9px 10px', fontSize: '0.8125rem', outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 120ms ease',
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
        <span style={{ color: overLimit ? C.stop : C.muted, fontSize: 11, fontFamily: 'monospace' }}>{len}/{max}</span>
      </div>
      {multiline ? (
        <textarea
          value={value} disabled={disabled} rows={3}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, resize: 'none' }}
        />
      ) : (
        <input
          value={value} disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      )}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────

interface Props {
  angle: Angle;
  platform: Platform;
  controller: ReturnType<typeof useCreatives>;
  fallback: { headline: string; primary_text: string; description?: string; cta?: string };
}

export function CreativeEditor({
  angle, platform, controller, fallback,
}: Props) {
  const row = controller.byKey.get(`${angle.id}::${platform}`);
  const status: CreativeStatus = row?.status ?? 'draft';
  const limits = LIMITS_BY_PLATFORM[platform];

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

  const showApprove = status === 'draft' || status === 'reviewing' || status === 'rejected' || status === 'failed';
  const showReject = status === 'reviewing' || status === 'draft';
  const showReopen = status === 'approved' || status === 'rejected';

  const handleApprove = async () => {
    try { await controller.approve(angle.id, platform); }
    catch (err) { alert(err instanceof Error ? err.message : 'Approve failed'); }
  };
  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    try {
      await controller.reject(angle.id, platform, rejectionReason.trim());
      setShowRejectBox(false); setRejectionReason('');
    } catch (err) { alert(err instanceof Error ? err.message : 'Reject failed'); }
  };
  const handleReopen = async () => {
    try { await controller.reopen(angle.id, platform); }
    catch (err) { alert(err instanceof Error ? err.message : 'Reopen failed'); }
  };
  const handleRegenerate = async () => {
    try {
      await controller.regenerate(angle.id, platform, direction.trim() || undefined);
      setDirection('');
    } catch (err) { alert(err instanceof Error ? err.message : 'Regenerate failed'); }
  };
  const handleScan = async () => {
    try { await controller.scan(angle.id, platform); }
    catch (err) { alert(err instanceof Error ? err.message : 'Scan failed'); }
  };

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: 14,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* ── header row ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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

      {/* ── editable fields ─────────────────────────────────── */}
      <div>
        <FieldRow label="Headline" value={headline} max={limits.headline}
          onChange={(v) => controller.editField(angle.id, platform, 'headline', v)}
          disabled={editLocked} />
        <FieldRow label="Primary text" value={primaryText} max={limits.body} multiline
          onChange={(v) => controller.editField(angle.id, platform, 'primary_text', v)}
          disabled={editLocked} />
        <FieldRow label="Description" value={description} max={limits.description}
          onChange={(v) => controller.editField(angle.id, platform, 'description', v)}
          disabled={editLocked} />
        <FieldRow label="CTA" value={cta} max={40}
          onChange={(v) => controller.editField(angle.id, platform, 'cta', v)}
          disabled={editLocked} />
      </div>

      {/* ── policy + actions ────────────────────────────────── */}
      <div style={{ background: C.canvas, borderRadius: 10, padding: 10 }}>
        <PolicyBlock severity={row?.policy_severity ?? null} issues={row?.policy_issues ?? null} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <button onClick={handleScan} disabled={busy} style={btnSecondary(busy)}>
            {busy ? '…' : 'Scan'}
          </button>
          {showApprove && (
            <button onClick={handleApprove} disabled={busy || row?.policy_severity === 'block'}
              style={btnPrimary(busy || row?.policy_severity === 'block')}>
              Approve
            </button>
          )}
          {showReject && (
            <button onClick={() => setShowRejectBox((v) => !v)} disabled={busy} style={btnDanger(busy)}>
              Reject
            </button>
          )}
          {showReopen && (
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
              style={{
                width: '100%', boxSizing: 'border-box',
                border: `1px solid ${C.border}`, borderRadius: 10,
                background: C.surface, color: C.ink,
                padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'none',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <button onClick={handleReject} disabled={!rejectionReason.trim() || busy}
                style={btnDanger(!rejectionReason.trim() || busy)}>
                Confirm reject
              </button>
            </div>
          </div>
        )}

        {!editLocked && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Regenerate copy
            </span>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                placeholder="Optional steering, e.g. 'more urgent'"
                style={{
                  flex: 1, minWidth: 0, boxSizing: 'border-box',
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  background: C.surface, color: C.ink,
                  padding: '8px 10px', fontSize: 12, outline: 'none',
                  fontFamily: 'inherit',
                }}
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
  );
}

// ── Button + chip styles ──────────────────────────────────────────────────

const baseBtn: CSSProperties = {
  height: 30, padding: '0 12px',
  border: 'none', borderRadius: 8,
  fontSize: 12, fontWeight: 800,
  cursor: 'pointer',
};
const btnPrimary = (disabled: boolean): CSSProperties => ({
  ...baseBtn, background: C.ink, color: '#FFF',
  opacity: disabled ? 0.55 : 1, cursor: disabled ? 'default' : 'pointer',
});
const btnSecondary = (disabled: boolean): CSSProperties => ({
  ...baseBtn, background: C.faint, color: C.ink,
  opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer',
});
const btnDanger = (disabled: boolean): CSSProperties => ({
  ...baseBtn, background: C.stop, color: '#FFF',
  opacity: disabled ? 0.55 : 1, cursor: disabled ? 'default' : 'pointer',
});
