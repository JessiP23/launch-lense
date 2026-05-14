'use client';

// ─────────────────────────────────────────────────────────────────────────────
// DeployGate — top-of-panel banner that drives the launch action.
//
// Four states:
//   1. INCOMPLETE — at least one channel still missing an approved creative.
//      Blocks the launch button.
//   2. READY — every active channel has an approved + policy-clean creative.
//      Surfaces a "Launch live ads" button that opens the inline targeting
//      step (#3) below.
//   3. CONFIRM — inline form asking the user to confirm or edit the target
//      countries. Pre-filled with the geo auto-detected from the request's
//      IP (via /api/geo). Confirms by calling /campaign/activate with the
//      chosen countries.
//   4. LIVE — campaign already activated (parent supplies `liveCampaignId`
//      or activation just succeeded). Shows the live targeting context.
//
// Auto-detect + manual override = the right default for 99% of users with
// a single click of escape hatch for the rest. No DB column needed; the
// chosen targeting is forwarded straight into Meta's adset spec.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, type CSSProperties } from 'react';
import type { Platform } from '@/lib/agents/types';
import type { useCreatives } from '@/hooks/use-creatives';

// Minimal ISO-2 → display name map for the country chips. We keep this
// small + curated rather than shipping a 250-entry locale list; the picker
// also accepts arbitrary uppercase 2-letter codes typed by the user.
const COUNTRY_OPTIONS: Array<{ code: string; label: string; flag: string }> = [
  { code: 'US', label: 'United States', flag: '🇺🇸' },
  { code: 'CA', label: 'Canada',        flag: '🇨🇦' },
  { code: 'GB', label: 'United Kingdom',flag: '🇬🇧' },
  { code: 'IE', label: 'Ireland',       flag: '🇮🇪' },
  { code: 'DE', label: 'Germany',       flag: '🇩🇪' },
  { code: 'FR', label: 'France',        flag: '🇫🇷' },
  { code: 'ES', label: 'Spain',         flag: '🇪🇸' },
  { code: 'IT', label: 'Italy',         flag: '🇮🇹' },
  { code: 'NL', label: 'Netherlands',   flag: '🇳🇱' },
  { code: 'SE', label: 'Sweden',        flag: '🇸🇪' },
  { code: 'AU', label: 'Australia',     flag: '🇦🇺' },
  { code: 'NZ', label: 'New Zealand',   flag: '🇳🇿' },
  { code: 'BR', label: 'Brazil',        flag: '🇧🇷' },
  { code: 'MX', label: 'Mexico',        flag: '🇲🇽' },
  { code: 'IN', label: 'India',         flag: '🇮🇳' },
  { code: 'SG', label: 'Singapore',     flag: '🇸🇬' },
  { code: 'JP', label: 'Japan',         flag: '🇯🇵' },
];

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
  const [liveCountries, setLiveCountries] = useState<string[] | null>(null);

  // The CONFIRM step: when the user clicks "Launch live ads" we don't fire
  // immediately. We open an inline targeting picker so the user confirms
  // (or edits) the country mix. Pre-filled with the geo auto-detected from
  // the request IP via /api/geo.
  const [confirming, setConfirming] = useState(false);
  const [countries, setCountries] = useState<string[]>([]);
  const [customCode, setCustomCode] = useState('');

  // Fetch the auto-detect default the moment we enter the CONFIRM step.
  useEffect(() => {
    if (!confirming || countries.length) return;
    let cancelled = false;
    fetch('/api/geo')
      .then((r) => r.json())
      .then((data: { country?: string }) => {
        if (cancelled) return;
        const c = (data?.country ?? 'US').toUpperCase();
        if (/^[A-Z]{2}$/.test(c)) setCountries([c]);
      })
      .catch(() => {
        if (!cancelled) setCountries(['US']);
      });
    return () => { cancelled = true; };
  }, [confirming, countries.length]);

  const toggleCountry = (code: string) => {
    setCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const addCustomCode = () => {
    const c = customCode.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(c) && !countries.includes(c)) {
      setCountries((prev) => [...prev, c]);
    }
    setCustomCode('');
  };

  const handleConfirmActivate = async () => {
    if (!countries.length) {
      setError('Pick at least one country.');
      return;
    }
    setActivating(true);
    setError(null);
    try {
      const res = await controller.activateCampaign({ countries });
      const id = res?.campaign_id ?? null;
      const live = res?.targeting?.countries ?? countries;
      if (id) {
        setActiveNow(id);
        setLiveCountries(live);
        setConfirming(false);
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
        {liveCountries && liveCountries.length > 0 && (
          <span style={{ color: C.muted, fontSize: 12 }}>
            · targeting {liveCountries.join(', ')}
          </span>
        )}
      </div>
    );
  }

  // ── CONFIRM state ──────────────────────────────────────────────────────
  if (confirming) {
    return (
      <div style={{ ...banner('ready'), flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={dot(C.go)} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>Choose where to launch</div>
            <div style={{ fontSize: 12, color: C.muted }}>
              We&apos;ve pre-selected your location. Add or remove countries before going live.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {COUNTRY_OPTIONS.map((c) => {
            const selected = countries.includes(c.code);
            return (
              <button
                key={c.code}
                onClick={() => toggleCountry(c.code)}
                style={chipBtn(selected)}
                type="button"
              >
                <span aria-hidden>{c.flag}</span> {c.code}
              </button>
            );
          })}
          {countries.filter((c) => !COUNTRY_OPTIONS.find((o) => o.code === c)).map((code) => (
            <button
              key={code}
              onClick={() => toggleCountry(code)}
              style={chipBtn(true)}
              type="button"
            >
              {code} ×
            </button>
          ))}
        </div>

        <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value.slice(0, 2))}
            onKeyDown={(e) => { if (e.key === 'Enter') addCustomCode(); }}
            placeholder="Other ISO code"
            maxLength={2}
            style={inputStyle}
          />
          <button onClick={addCustomCode} type="button" style={secondaryBtn}>Add</button>
          <div style={{ flex: 1 }} />
          <button onClick={() => { setConfirming(false); setError(null); }} type="button" style={secondaryBtn}>
            Cancel
          </button>
          <button onClick={handleConfirmActivate} disabled={activating || countries.length === 0} style={launchBtn(activating || countries.length === 0)}>
            {activating ? 'Activating…' : `Confirm & launch${countries.length ? ` (${countries.length})` : ''}`}
          </button>
        </div>

        {error && <div style={{ marginTop: 6, color: C.stop, fontSize: 12 }}>{error}</div>}
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
        <button onClick={() => setConfirming(true)} disabled={activating} style={launchBtn(activating)}>
          Launch live ads
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

const chipBtn = (selected: boolean): CSSProperties => ({
  height: 30, padding: '0 10px',
  border: `1px solid ${selected ? C.ink : C.border}`,
  borderRadius: 8,
  background: selected ? C.ink : C.surface,
  color: selected ? '#FFF' : C.ink,
  fontSize: 12, fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 4,
});

const secondaryBtn: CSSProperties = {
  height: 30, padding: '0 12px',
  border: `1px solid ${C.border}`, borderRadius: 8,
  background: C.surface, color: C.ink,
  fontSize: 12, fontWeight: 700,
  cursor: 'pointer',
};

const inputStyle: CSSProperties = {
  height: 30, width: 90, padding: '0 8px',
  border: `1px solid ${C.border}`, borderRadius: 8,
  background: C.surface, color: C.ink,
  fontSize: 12, fontWeight: 600,
  textTransform: 'uppercase',
};
