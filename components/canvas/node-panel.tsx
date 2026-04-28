'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAppStore, type PlatformId, type ConnectedPlatform } from '@/lib/store';
import type { SprintRecord } from '@/lib/agents/types';

const C = {
  ink: '#111110', muted: '#8C8880', border: '#E8E4DC',
  surface: '#FFFFFF', canvas: '#FAFAF8', faint: '#F3F0EB',
  go: '#059669', warn: '#D97706', stop: '#DC2626',
};

export type PanelId =
  | 'accounts' | 'genome' | 'healthgate' | 'angles'
  | 'campaign' | 'verdict' | 'report'
  | 'benchmarks' | 'settings' | null;

interface Props {
  panel:       PanelId;
  channel?:    string;
  sprint?:     SprintRecord | null;
  onClose:     () => void;
  onEditSetup: (sprintId: string) => void;
}

// ── shared label ─────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: 4 }}>
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.02em', color: C.ink, margin: '0 0 16px' }}>
      {children}
    </h2>
  );
}

function Pill({ value, go }: { value: string; go?: boolean }) {
  const color = value === 'GO' ? C.go : value === 'NO-GO' || value === 'STOP' ? C.stop : C.warn;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, fontSize: '0.6875rem', fontWeight: 600, background: `${color}18`, color }}>
      {value}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Accounts Panel
// ════════════════════════════════════════════════════════════════════════════
const PLATFORMS: { id: PlatformId; name: string; reach: string; capabilities: string[]; demoConnect: boolean }[] = [
  { id: 'meta',     name: 'Meta Ads',     reach: '3.2B monthly active users',  capabilities: ['Paid Social', 'Pixel Tracking', 'Audience Graph'], demoConnect: false },
  { id: 'google',   name: 'Google Ads',   reach: '8.5B daily searches',        capabilities: ['Search Ads', 'Display', 'Keyword Planner'], demoConnect: true },
  { id: 'tiktok',   name: 'TikTok Ads',   reach: '1.5B monthly active users',  capabilities: ['In-Feed Video', 'Spark Ads', 'TikTok Pixel'], demoConnect: true },
  { id: 'linkedin', name: 'LinkedIn Ads', reach: '1B professional members',    capabilities: ['Sponsored Content', 'Lead Gen Forms', 'Matched Audiences'], demoConnect: true },
];

function AccountsPanel() {
  const { connectedPlatforms, connectPlatform, disconnectPlatform } = useAppStore();
  const [demoConnecting, setDemoConnecting] = useState<PlatformId | null>(null);
  const [disconnecting, setDisconnecting] = useState<PlatformId | null>(null);

  const getConn = (id: PlatformId): ConnectedPlatform | null =>
    connectedPlatforms.find((c) => c.platform === id) ?? null;

  const handleDemoConnect = async (id: PlatformId) => {
    setDemoConnecting(id);
    await new Promise((r) => setTimeout(r, 1100));
    connectPlatform({ platform: id, accountId: `demo_${id}_${Date.now()}`, connectedAt: new Date().toISOString() });
    setDemoConnecting(null);
  };

  const handleDisconnect = async (id: PlatformId) => {
    setDisconnecting(id);
    await new Promise((r) => setTimeout(r, 500));
    disconnectPlatform(id);
    setDisconnecting(null);
  };

  return (
    <div>
      <SectionTitle>Platform Accounts</SectionTitle>
      <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: 20 }}>
        Connect ad platforms before running a sprint. Healthgate checks run on each connected account.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PLATFORMS.map((p) => {
          const conn = getConn(p.id);
          const isDemo = demoConnecting === p.id;
          const isDisc = disconnecting === p.id;
          return (
            <div key={p.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: C.ink }}>{p.name}</span>
                    {conn && (
                      <span style={{ fontSize: '0.625rem', fontWeight: 600, color: C.go, background: `${C.go}15`, padding: '1px 6px', borderRadius: 99 }}>Connected</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: C.muted, margin: '0 0 6px' }}>{p.reach}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {p.capabilities.map((c) => (
                      <span key={c} style={{ fontSize: '0.625rem', fontWeight: 500, color: C.muted, background: C.faint, padding: '2px 6px', borderRadius: 6 }}>{c}</span>
                    ))}
                  </div>
                  {conn && (
                    <p style={{ fontSize: '0.6875rem', fontFamily: 'monospace', color: C.muted, marginTop: 6 }}>{conn.accountId}</p>
                  )}
                </div>
                <div style={{ flexShrink: 0 }}>
                  {conn ? (
                    <button
                      onClick={() => handleDisconnect(p.id)}
                      disabled={!!isDisc}
                      style={{ height: 28, padding: '0 10px', border: `1px solid ${C.border}`, background: 'transparent', borderRadius: 8, fontSize: '0.8125rem', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {isDisc && <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />}
                      {isDisc ? 'Removing…' : 'Remove'}
                    </button>
                  ) : p.demoConnect ? (
                    <button
                      onClick={() => handleDemoConnect(p.id)}
                      disabled={!!isDemo}
                      style={{ height: 28, padding: '0 10px', background: C.ink, border: 'none', borderRadius: 8, fontSize: '0.8125rem', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {isDemo && <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />}
                      {isDemo ? 'Connecting…' : 'Connect'}
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: C.muted }}>OAuth</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Genome Panel
// ════════════════════════════════════════════════════════════════════════════
function GenomePanel({ sprint }: { sprint?: SprintRecord | null }) {
  const g = sprint?.genome;
  if (!g) return <p style={{ color: C.muted, fontSize: '0.875rem' }}>Genome has not run yet for this sprint.</p>;

  const axes = [
    { key: 'demand' as const, label: 'Demand', w: '30%' },
    { key: 'icp' as const, label: 'ICP', w: '25%' },
    { key: 'competition' as const, label: 'Competition', w: '20%' },
    { key: 'timing' as const, label: 'Timing', w: '15%' },
    { key: 'moat' as const, label: 'Moat', w: '10%' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <SectionTitle>Genome Analysis</SectionTitle>
        <Pill value={g.signal} />
      </div>

      <div style={{ background: C.ink, borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
        <Label><span style={{ color: '#FFFFFF80' }}>Composite Score</span></Label>
        <p style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '2.5rem', color: '#FFF', lineHeight: 1, margin: 0 }}>{g.composite}</p>
        <p style={{ fontSize: '0.75rem', color: '#FFFFFF60', marginTop: 4 }}>/100 weighted</p>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
        <Label>Axis Scores</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {axes.map(({ key, label, w }) => {
            const val = g.scores[key];
            const color = val >= 70 ? C.go : val >= 40 ? C.warn : C.stop;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 72, fontSize: '0.6875rem', color: C.muted, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: 5, borderRadius: 99, background: C.faint, overflow: 'hidden' }}>
                  <div style={{ width: `${val}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                </div>
                <span style={{ width: 28, fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', color, textAlign: 'right' }}>{val}</span>
                <span style={{ width: 28, fontSize: '0.625rem', color: C.muted }}>{w}</span>
              </div>
            );
          })}
        </div>
      </div>

      {g.risks.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
          <Label>Risks</Label>
          <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.risks.map((r, i) => (
              <li key={i} style={{ fontSize: '0.8125rem', color: C.ink, paddingLeft: 12, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0, color: C.stop }}>·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {g.proceed_note && (
        <div style={{ background: '#ECFDF5', border: `1px solid ${C.go}30`, borderRadius: 12, padding: '14px 16px' }}>
          <Label><span style={{ color: C.go }}>Proceed Note</span></Label>
          <p style={{ fontSize: '0.875rem', color: C.ink, margin: '4px 0 0' }}>{g.proceed_note}</p>
        </div>
      )}
      {g.pivot_brief && (
        <div style={{ background: '#FEF2F2', border: `1px solid ${C.stop}30`, borderRadius: 12, padding: '14px 16px' }}>
          <Label><span style={{ color: C.stop }}>Pivot Brief</span></Label>
          <p style={{ fontSize: '0.875rem', color: C.ink, margin: '4px 0 0' }}>{g.pivot_brief}</p>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Healthgate Panel
// ════════════════════════════════════════════════════════════════════════════
function HealthgatePanel({ sprint, channel }: { sprint?: SprintRecord | null; channel?: string }) {
  const hg = sprint?.healthgate;
  const CHANNELS = ['meta', 'google', 'linkedin', 'tiktok'] as const;

  if (!hg) return <p style={{ color: C.muted, fontSize: '0.875rem' }}>Healthgate has not run yet.</p>;

  const WEIGHT_PTS: Record<string, string> = { CRITICAL: 'caps at 40', HIGH: '−15', MEDIUM: '−8', LOW: '−4' };

  const renderChannel = (ch: typeof CHANNELS[number]) => {
    const h = hg[ch];
    if (!h) return null;
    const sc = h.status === 'HEALTHY' ? C.go : h.status === 'WARN' ? C.warn : C.stop;
    return (
      <div key={ch} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: C.ink, textTransform: 'capitalize' }}>{ch}</span>
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: sc, background: `${sc}15`, padding: '2px 8px', borderRadius: 99 }}>{h.status}</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.125rem', color: sc, marginLeft: 'auto' }}>{h.score}/100</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {h.checks.map((chk) => (
            <div key={chk.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: chk.passed ? C.faint : '#FEF2F2', borderRadius: 8, border: `1px solid ${chk.passed ? C.border : `${C.stop}20`}` }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: chk.passed ? C.go : C.stop, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '0.8125rem', color: C.ink }}>{chk.name}</span>
              <span style={{ fontSize: '0.625rem', fontWeight: 600, color: C.muted }}>{chk.weight}</span>
              {!chk.passed && <span style={{ fontSize: '0.6875rem', color: C.stop }}>{WEIGHT_PTS[chk.weight]}</span>}
            </div>
          ))}
        </div>
        {h.blocking_issues.length > 0 && (
          <div style={{ marginTop: 8, padding: '10px 12px', background: '#FEF2F2', borderRadius: 8, border: `1px solid ${C.stop}20` }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: C.stop, marginBottom: 4 }}>Blocking Issues</p>
            {h.fix_summary.map((f, i) => (
              <p key={i} style={{ fontSize: '0.75rem', color: C.ink, margin: '2px 0' }}>· {f}</p>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <SectionTitle>Healthgate</SectionTitle>
      {channel ? renderChannel(channel as typeof CHANNELS[number]) : CHANNELS.map(renderChannel)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Angles Panel
// ════════════════════════════════════════════════════════════════════════════
function AnglesPanel({ sprint }: { sprint?: SprintRecord | null }) {
  const a = sprint?.angles;
  if (!a?.angles?.length) return <p style={{ color: C.muted, fontSize: '0.875rem' }}>Angles have not been generated yet.</p>;

  return (
    <div>
      <SectionTitle>Ad Angles</SectionTitle>
      <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: 16 }}>
        ICP: <strong style={{ color: C.ink }}>{a.icp}</strong>
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {a.angles.map((angle) => (
          <div key={angle.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8125rem', color: C.ink }}>{angle.id}</span>
              <span style={{ fontSize: '0.625rem', fontWeight: 600, color: C.muted, background: C.faint, padding: '2px 7px', borderRadius: 99 }}>{angle.archetype}</span>
              <span style={{ fontSize: '0.625rem', color: C.muted, marginLeft: 'auto' }}>{angle.emotional_lever}</span>
            </div>
            {(['meta', 'google', 'linkedin', 'tiktok'] as const).map((ch) => {
              const copy = angle.copy[ch];
              if (!copy) return null;
              const headline = ch === 'meta' ? (copy as { headline: string }).headline
                : ch === 'google' ? (copy as { headline1: string; headline2: string }).headline1
                : ch === 'linkedin' ? (copy as { headline: string }).headline
                : (copy as { hook: string }).hook;
              const body = ch === 'meta' ? (copy as { body: string }).body
                : ch === 'google' ? (copy as { description: string }).description
                : ch === 'linkedin' ? (copy as { body: string }).body
                : (copy as { overlay: string }).overlay;
              return (
                <div key={ch} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.muted, marginBottom: 3 }}>{ch}</p>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.ink, margin: '0 0 2px' }}>{typeof copy === 'string' ? copy : JSON.stringify(copy)}</p>
                  {body && <p style={{ fontSize: '0.75rem', color: C.muted, margin: 0 }}>{typeof body === 'string' ? body : JSON.stringify(body)}</p>}
                </div>
              );
            })}
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: C.ink, margin: 0 }}>CTA: {angle.cta}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Campaign Panel (live metrics)
// ════════════════════════════════════════════════════════════════════════════
function CampaignPanel({ sprint, channel, onEditSetup }: { sprint?: SprintRecord | null; channel?: string; onEditSetup: (id: string) => void }) {
  const CHANNELS = ['meta', 'google', 'linkedin', 'tiktok'] as const;

  const renderChannel = (ch: typeof CHANNELS[number]) => {
    const c = sprint?.campaign?.[ch];
    return (
      <div key={ch} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: C.ink, textTransform: 'capitalize' }}>{ch}</span>
          {c && <span style={{ fontSize: '0.6875rem', color: C.muted, fontFamily: 'monospace' }}>{c.campaign_id}</span>}
        </div>
        {!c ? (
          <p style={{ fontSize: '0.8125rem', color: C.muted }}>Not launched on this channel.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Impressions', val: c.angle_metrics.reduce((s, a) => s + a.impressions, 0).toLocaleString() },
              { label: 'Clicks',      val: c.angle_metrics.reduce((s, a) => s + a.clicks, 0).toLocaleString() },
              { label: 'Avg CTR',     val: (() => { const tot = c.angle_metrics.reduce((s, a) => s + a.impressions, 0); return tot > 0 ? `${((c.angle_metrics.reduce((s, a) => s + a.clicks, 0) / tot) * 100).toFixed(2)}%` : '—'; })() },
              { label: 'Spend',       val: c.spent_cents != null ? `$${(c.spent_cents / 100).toFixed(0)}` : '—' },
              { label: 'Budget',      val: c.budget_cents != null ? `$${(c.budget_cents / 100).toFixed(0)}` : '—' },
              { label: 'Status',      val: c.status ?? '—' },
            ].map(({ label, val }) => (
              <div key={label} style={{ background: C.faint, borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.muted, margin: '0 0 3px' }}>{label}</p>
                <p style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', color: C.ink, margin: 0 }}>{val}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <SectionTitle>Campaigns</SectionTitle>
        {sprint && (
          <button
            onClick={() => onEditSetup(sprint.sprint_id)}
            style={{ height: 28, padding: '0 10px', border: `1px solid ${C.border}`, background: 'transparent', borderRadius: 8, fontSize: '0.8125rem', color: C.muted, cursor: 'pointer' }}
          >
            Edit Setup
          </button>
        )}
      </div>
      {channel
        ? renderChannel(channel as typeof CHANNELS[number])
        : CHANNELS.map(renderChannel)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Verdict Panel
// ════════════════════════════════════════════════════════════════════════════
function VerdictPanel({ sprint }: { sprint?: SprintRecord | null }) {
  const v = sprint?.verdict;
  if (!v) return <p style={{ color: C.muted, fontSize: '0.875rem' }}>Verdict not yet generated.</p>;

  const CHANNELS = ['meta', 'google', 'linkedin', 'tiktok'] as const;
  const aggColor = v.verdict === 'GO' ? C.go : v.verdict === 'NO-GO' ? C.stop : C.warn;

  return (
    <div>
      <SectionTitle>Verdict</SectionTitle>

      {/* Aggregate */}
      <div style={{ background: C.ink, borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
        <Label><span style={{ color: '#FFFFFF80' }}>Aggregate Verdict</span></Label>
        <p style={{ fontWeight: 800, fontSize: '2rem', color: aggColor, fontFamily: 'monospace', lineHeight: 1, margin: '4px 0 8px' }}>
          {v.verdict}
        </p>
        <p style={{ fontSize: '0.8125rem', color: '#FFFFFF90', margin: 0 }}>{v.reasoning}</p>
        {v.recommended_channel && (
          <p style={{ fontSize: '0.75rem', color: '#FFFFFF60', marginTop: 8 }}>
            Best channel: <span style={{ color: '#FFF', fontWeight: 600 }}>{v.recommended_channel}</span>
          </p>
        )}
      </div>

      {/* Per-channel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(v.per_channel ?? []).map((cv) => {
          const sc = cv.verdict === 'GO' ? C.go : cv.verdict === 'NO-GO' ? C.stop : C.warn;
          return (
            <div key={cv.channel} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: C.ink, textTransform: 'capitalize' }}>{cv.channel}</span>
                <Pill value={cv.verdict} />
                <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.875rem', color: sc }}>
                  {cv.blended_ctr != null ? `${(cv.blended_ctr * 100).toFixed(2)}% CTR` : ''}
                </span>
              </div>
              {cv.reasoning && <p style={{ fontSize: '0.8125rem', color: C.muted, margin: 0 }}>{cv.reasoning}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Report Panel
// ════════════════════════════════════════════════════════════════════════════
function ReportPanel({ sprint }: { sprint?: SprintRecord | null }) {
  if (!sprint?.verdict) return <p style={{ color: C.muted, fontSize: '0.875rem' }}>Report will be available once the verdict is complete.</p>;

  const v = sprint.verdict;
  const m = sprint.verdict.aggregate_metrics;
  const aggColor = v.verdict === 'GO' ? C.go : v.verdict === 'NO-GO' ? C.stop : C.warn;

  return (
    <div>
      <SectionTitle>Report</SectionTitle>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.5rem', color: aggColor }}>{v.verdict}</span>
          {v.confidence != null && <span style={{ fontSize: '0.75rem', color: C.muted }}>{v.confidence}% confidence</span>}
        </div>
        <p style={{ fontSize: '0.8125rem', color: C.ink, margin: '0 0 12px' }}>{v.reasoning}</p>
        {m && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {[
              { label: 'Total Spend', val: `$${(m.total_spend_cents / 100).toFixed(0)}` },
              { label: 'Impressions', val: m.total_impressions?.toLocaleString() ?? '—' },
              { label: 'CTR',         val: m.weighted_blended_ctr != null ? `${(m.weighted_blended_ctr * 100).toFixed(2)}%` : '—' },
            ].map(({ label, val }) => (
              <div key={label} style={{ background: C.faint, borderRadius: 8, padding: '8px 10px' }}>
                <p style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.muted, margin: '0 0 2px' }}>{label}</p>
                <p style={{ fontFamily: 'monospace', fontWeight: 700, color: C.ink, margin: 0 }}>{val}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <a
        href={`/api/reports/${sprint.sprint_id}`}
        target="_blank"
        rel="noreferrer"
        style={{ display: 'block', width: '100%', textAlign: 'center', padding: '10px', background: C.ink, color: '#FFF', borderRadius: 10, fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}
      >
        Download PDF Report
      </a>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Benchmarks Panel
// ════════════════════════════════════════════════════════════════════════════
const BENCHMARKS = [
  { vertical: 'SaaS',        avg_ctr: 1.2, avg_cvr: 2.5, avg_cpa: 45, sample_size: 1200 },
  { vertical: 'E-commerce',  avg_ctr: 1.8, avg_cvr: 3.2, avg_cpa: 32, sample_size: 2400 },
  { vertical: 'Health',      avg_ctr: 0.9, avg_cvr: 1.8, avg_cpa: 58, sample_size: 800 },
  { vertical: 'Fintech',     avg_ctr: 1.1, avg_cvr: 2.1, avg_cpa: 52, sample_size: 600 },
  { vertical: 'Education',   avg_ctr: 1.4, avg_cvr: 2.8, avg_cpa: 38, sample_size: 950 },
  { vertical: 'Marketplace', avg_ctr: 1.3, avg_cvr: 2.2, avg_cpa: 48, sample_size: 500 },
];

function BenchmarksPanel() {
  const total = BENCHMARKS.reduce((s, b) => s + b.sample_size, 0);
  return (
    <div>
      <SectionTitle>Meta Ads Benchmarks</SectionTitle>
      <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: 16 }}>
        Aggregated from {total.toLocaleString()} campaigns — used in Go/No-Go verdict calculations.
      </p>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ background: C.faint, borderBottom: `1px solid ${C.border}` }}>
              {['Vertical', 'Avg CTR', 'Avg CVR', 'Avg CPA', 'Sample'].map((h, i) => (
                <th key={h} style={{ padding: '8px 12px', fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BENCHMARKS.map((b, i) => (
              <tr key={b.vertical} style={{ borderBottom: i < BENCHMARKS.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <td style={{ padding: '9px 12px', fontWeight: 500, color: C.ink }}>{b.vertical}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: C.ink }}>{b.avg_ctr.toFixed(1)}%</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: C.ink }}>{b.avg_cvr.toFixed(1)}%</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: C.ink }}>${b.avg_cpa}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: C.muted }}>{b.sample_size.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Settings Panel
// ════════════════════════════════════════════════════════════════════════════
function SettingsPanel() {
  const { setActiveAccountId, setOrgId } = useAppStore();
  const [accountId, setAccountId] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!accountId.trim() || !token.trim()) { setError('Both fields required'); return; }
    setLoading(true); setError(null); setSuccess(null);
    try {
      const res = await fetch('/api/accounts/byok', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token.trim(), account_id: accountId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); return; }
      setActiveAccountId(data.account.id);
      if (data.org_id) setOrgId(data.org_id);
      setSuccess(`Connected: ${data.account.name}`);
      setAccountId(''); setToken('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally { setLoading(false); }
  };

  const inputStyle = {
    width: '100%', background: C.canvas, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: '8px 10px', fontSize: '0.875rem', color: C.ink,
    fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' as const,
  };

  return (
    <div>
      <SectionTitle>Settings</SectionTitle>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px' }}>
        <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: C.ink, marginBottom: 4 }}>Connect Meta Account</p>
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginBottom: 14 }}>
          Paste your Meta access token and ad account ID. Verified against the Meta Graph API before saving.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <Label>Ad Account ID</Label>
            <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="act_727146616453623" style={inputStyle} />
          </div>
          <div>
            <Label>Access Token</Label>
            <textarea value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAxxxxxxxxxxxxxxx…" rows={3} style={{ ...inputStyle, resize: 'none' }} />
          </div>
          {error && <p style={{ fontSize: '0.8125rem', color: C.stop }}>{error}</p>}
          {success && <p style={{ fontSize: '0.8125rem', color: C.go }}>{success}</p>}
          <button
            onClick={handleSubmit} disabled={loading}
            style={{ height: 34, background: C.ink, border: 'none', borderRadius: 8, color: '#FFF', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {loading && <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />}
            {loading ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Panel Shell  
// ════════════════════════════════════════════════════════════════════════════
export function NodePanel({ panel, channel, sprint, onClose, onEditSetup }: Props) {
  const router = useRouter();

  if (!panel) return null;

  const content = () => {
    switch (panel) {
      case 'accounts':   return <AccountsPanel />;
      case 'genome':     return <GenomePanel sprint={sprint} />;
      case 'healthgate': return <HealthgatePanel sprint={sprint} channel={channel} />;
      case 'angles':     return <AnglesPanel sprint={sprint} />;
      case 'campaign':   return <CampaignPanel sprint={sprint} channel={channel} onEditSetup={onEditSetup} />;
      case 'verdict':    return <VerdictPanel sprint={sprint} />;
      case 'report':     return <ReportPanel sprint={sprint} />;
      case 'benchmarks': return <BenchmarksPanel />;
      case 'settings':   return <SettingsPanel />;
      default: return null;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key={panel + (channel ?? '')}
        initial={{ x: 360, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 360, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        style={{
          position: 'absolute', top: 48, right: 0, bottom: 0,
          width: 380,
          background: C.canvas,
          borderLeft: `1px solid ${C.border}`,
          zIndex: 20,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Panel header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {sprint && (
              <span style={{ fontSize: '0.6875rem', fontFamily: 'monospace', color: C.muted }}>
                {sprint.sprint_id.slice(0, 8)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', color: C.muted, fontSize: '0.9rem' }}
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        {/* Panel content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>
          {content()}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
