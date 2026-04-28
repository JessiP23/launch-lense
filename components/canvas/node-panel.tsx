'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAppStore, type PlatformId, type ConnectedPlatform } from '@/lib/store';
import type { Angle, Platform, SprintRecord } from '@/lib/agents/types';

const C = {
  ink: '#111110', muted: '#8C8880', border: '#E8E4DC',
  surface: '#FFFFFF', canvas: '#FAFAF8', faint: '#F3F0EB',
  go: '#111110', warn: '#8C8880', stop: '#DC2626',
};

export type PanelId =
  | 'accounts' | 'genome' | 'healthgate' | 'angles'
  | 'creative' | 'landing' | 'campaign' | 'verdict' | 'report'
  | 'benchmarks' | 'settings' | null;

export type CreativeDraft = {
  channel: Platform;
  angleId: Angle['id'];
  angle: Angle;
  brandName: string;
  image: string | null;
};

export type LandingDraft = {
  mode: 'builder' | 'code';
  theme: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  cta: string;
  audience: string;
  offer: string;
  proof: string[];
  testimonial: string;
  formTitle: string;
  formSubtext: string;
  customHtml: string;
  customCss: string;
};

interface Props {
  panel:       PanelId;
  channel?:    string;
  sprint?:     SprintRecord | null;
  onClose:     () => void;
  onEditSetup: (sprintId: string) => void;
  onRunWorkflow?: (sprintId: string) => void;
  onContinueAfterAngles?: (sprintId: string) => void;
  onContinueAfterCreatives?: (sprintId: string) => void;
  creativeDraft?: CreativeDraft;
  onCreativeDraftChange?: (draft: CreativeDraft) => void;
  landingDraft?: LandingDraft | null;
  onLandingDraftChange?: (draft: LandingDraft) => void;
  onSprintPatched?: (rawSprint: unknown) => void;
  workflowRunning?: boolean;
  embedded?:   boolean;
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

function Pill({ value }: { value: string }) {
  const color = value === 'GO' ? C.go : value === 'NO-GO' || value === 'STOP' ? C.stop : C.warn;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, fontSize: '0.6875rem', fontWeight: 600, background: `${color}18`, color }}>
      {value}
    </span>
  );
}

function workflowActionLabel(sprint: SprintRecord): string {
  if (sprint.state === 'BLOCKED' && sprint.genome?.signal === 'STOP') return 'Override STOP';
  if (sprint.state === 'ANGLES_DONE') return 'Edit Creative Nodes';
  if (sprint.state === 'LANDING_DONE') return 'Open Campaign Gate';
  if (sprint.genome) return 'Resume Workflow';
  return 'Run Workflow';
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
    connectPlatform({ platform: id, accountId: `demo_${id}`, connectedAt: new Date().toISOString() });
    setDemoConnecting(null);
  };

  const handleDisconnect = async (id: PlatformId) => {
    setDisconnecting(id);
    await new Promise((r) => setTimeout(r, 500));
    disconnectPlatform(id);
    setDisconnecting(null);
  };

  const handleMetaOAuth = () => {
    window.location.href = '/api/auth/meta/start?platform=meta';
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
                    <button
                      onClick={handleMetaOAuth}
                      style={{ height: 28, padding: '0 10px', background: C.ink, border: 'none', borderRadius: 8, fontSize: '0.8125rem', color: '#FFF', cursor: 'pointer' }}
                    >
                      Connect
                    </button>
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
  const channels = (sprint?.active_channels?.length ? sprint.active_channels : ['meta', 'google', 'linkedin', 'tiktok']) as Platform[];

  if (!hg) return <p style={{ color: C.muted, fontSize: '0.875rem' }}>Healthgate has not run yet.</p>;

  const WEIGHT_PTS: Record<string, string> = { CRITICAL: 'caps at 40', HIGH: '−15', MEDIUM: '−8', LOW: '−4' };

  const renderChannel = (ch: Platform) => {
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
      {channel ? renderChannel(channel as Platform) : channels.map(renderChannel)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Angles Panel
// ════════════════════════════════════════════════════════════════════════════
function AnglesPanel({
  sprint,
  onContinue,
  onSprintPatched,
  workflowRunning,
}: {
  sprint?: SprintRecord | null;
  onContinue?: (sprintId: string) => void;
  onSprintPatched?: (rawSprint: unknown) => void;
  workflowRunning?: boolean;
}) {
  const a = sprint?.angles;
  const [selectedId, setSelectedId] = useState<Angle['id']>('angle_A');
  const [activeChannel, setActiveChannel] = useState<Platform>('meta');
  const [drafts, setDrafts] = useState<Record<string, Angle>>({});
  const [savingAngles, setSavingAngles] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const savedSelected = (a as { selected_angle_id?: Angle['id'] } | undefined)?.selected_angle_id;
    if (savedSelected) setSelectedId(savedSelected);
  }, [a]);

  if (!a?.angles?.length) return <p style={{ color: C.muted, fontSize: '0.875rem' }}>Angles have not been generated yet.</p>;

  const selectedAngle = drafts[selectedId] ?? a.angles.find((angle) => angle.id === selectedId) ?? a.angles[0];
  const availableChannels = (sprint?.active_channels?.length ? sprint.active_channels : ['meta', 'google', 'linkedin', 'tiktok']) as Platform[];
  const channel = availableChannels.includes(activeChannel) ? activeChannel : availableChannels[0];
  const copy = selectedAngle.copy[channel];

  const updateAngle = (updater: (angle: Angle) => Angle) => {
    setDrafts((prev) => {
      const base = prev[selectedAngle.id] ?? selectedAngle;
      return { ...prev, [selectedAngle.id]: updater(base) };
    });
  };

  const updateCopy = (field: string, value: string) => {
    updateAngle((angle) => ({
      ...angle,
      copy: {
        ...angle.copy,
        [channel]: {
          ...angle.copy[channel],
          [field]: value,
        },
      },
    }));
  };

  const handleSaveAngles = async () => {
    if (!sprint) return false;
    setSavingAngles(true);
    setSaveMessage(null);
    try {
      const editedAngles = a.angles.map((angle) => drafts[angle.id] ?? angle);
      const res = await fetch(`/api/sprint/${sprint.sprint_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ angles: { ...a, selected_angle_id: selectedAngle.id, angles: editedAngles } }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Save failed');
      }
      const data = await res.json().catch(() => null) as { sprint?: unknown } | null;
      if (data?.sprint) onSprintPatched?.(data.sprint);
      setSaveMessage('Saved. This selected angle now drives the creative nodes and the single landing page.');
      return true;
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Save failed');
      return false;
    } finally {
      setSavingAngles(false);
    }
  };

  const renderEditor = () => {
    const input = (label: string, field: string, value: string, limit: number, multiline = false) => (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
          <Label>{label}</Label>
          <span style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: value.length > limit ? C.warn : C.muted }}>{value.length}/{limit}</span>
        </div>
        {multiline ? (
          <textarea
            value={value}
            onChange={(event) => updateCopy(field, event.target.value)}
            rows={3}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'none', border: `1px solid ${value.length > limit ? C.warn : C.border}`, borderRadius: 10, background: C.canvas, color: C.ink, padding: '9px 10px', fontSize: '0.8125rem', outline: 'none' }}
          />
        ) : (
          <input
            value={value}
            onChange={(event) => updateCopy(field, event.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${value.length > limit ? C.warn : C.border}`, borderRadius: 10, background: C.canvas, color: C.ink, padding: '9px 10px', fontSize: '0.8125rem', outline: 'none' }}
          />
        )}
      </div>
    );

    if (channel === 'meta') {
      const meta = copy as Angle['copy']['meta'];
      return (
        <>
          {input('Headline', 'headline', meta.headline, 40)}
          {input('Body', 'body', meta.body, 125, true)}
        </>
      );
    }
    if (channel === 'google') {
      const google = copy as Angle['copy']['google'];
      return (
        <>
          {input('Headline 1', 'headline1', google.headline1, 30)}
          {input('Headline 2', 'headline2', google.headline2, 30)}
          {input('Description', 'description', google.description, 90, true)}
        </>
      );
    }
    if (channel === 'linkedin') {
      const linkedin = copy as Angle['copy']['linkedin'];
      return (
        <>
          {input('Intro', 'intro', linkedin.intro, 70)}
          {input('Headline', 'headline', linkedin.headline, 25)}
          {input('Body', 'body', linkedin.body, 150, true)}
        </>
      );
    }
    const tiktok = copy as Angle['copy']['tiktok'];
    return (
      <>
        {input('Hook', 'hook', tiktok.hook, 100, true)}
        {input('Overlay', 'overlay', tiktok.overlay, 80)}
      </>
    );
  };

  return (
    <div>
      <SectionTitle>Ad Angles</SectionTitle>
      <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: 16 }}>
        ICP: <strong style={{ color: C.ink }}>{a.icp}</strong>
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
        {a.angles.map((angle) => (
          <button
            key={angle.id}
            onClick={() => setSelectedId(angle.id)}
            style={{
              border: `1px solid ${selectedAngle.id === angle.id ? C.ink : C.border}`,
              background: selectedAngle.id === angle.id ? C.ink : C.surface,
              color: selectedAngle.id === angle.id ? '#FFF' : C.ink,
              borderRadius: 10,
              padding: '10px 8px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'block', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.6875rem' }}>{angle.id.replace('angle_', '')}</span>
            <span style={{ display: 'block', marginTop: 4, fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.75 }}>{angle.archetype}</span>
          </button>
        ))}
      </div>

      <div style={{ background: C.ink, borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <Label><span style={{ color: '#FFFFFF80' }}>Selected Angle</span></Label>
        <p style={{ color: '#FFF', fontWeight: 800, fontSize: '1rem', margin: '4px 0 4px' }}>{selectedAngle.archetype} · {selectedAngle.emotional_lever}</p>
        <p style={{ color: '#FFFFFF99', fontSize: '0.8125rem', margin: 0 }}>Edit the copy per channel before the landing and campaign agents consume it.</p>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {availableChannels.map((item) => (
          <button
            key={item}
            onClick={() => setActiveChannel(item)}
            style={{
              height: 30,
              padding: '0 10px',
              border: `1px solid ${channel === item ? C.ink : C.border}`,
              borderRadius: 8,
              background: channel === item ? C.ink : C.surface,
              color: channel === item ? '#FFF' : C.muted,
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'capitalize',
            }}
          >
            {item}
          </button>
        ))}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
        {renderEditor()}
        <div>
          <Label>CTA</Label>
          <input
            value={selectedAngle.cta}
            onChange={(event) => updateAngle((angle) => ({ ...angle, cta: event.target.value.slice(0, 40) }))}
            style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 10, background: C.canvas, color: C.ink, padding: '9px 10px', fontSize: '0.8125rem', outline: 'none' }}
          />
        </div>
        <button
          onClick={handleSaveAngles}
          disabled={savingAngles}
          style={{ height: 36, border: 'none', borderRadius: 10, background: C.ink, color: '#FFF', cursor: savingAngles ? 'default' : 'pointer', fontSize: '0.8125rem', fontWeight: 700, opacity: savingAngles ? 0.7 : 1 }}
        >
          {savingAngles ? 'Saving Copy' : 'Save Angle Copy'}
        </button>
        {saveMessage && (
          <p style={{ margin: 0, fontSize: '0.75rem', color: saveMessage.startsWith('Saved') ? C.go : C.stop }}>{saveMessage}</p>
        )}
        {sprint?.state === 'ANGLES_DONE' && onContinue && (
          <button
            onClick={async () => {
              const saved = await handleSaveAngles();
              if (saved) onContinue(sprint.sprint_id);
            }}
            disabled={workflowRunning}
            style={{ height: 38, border: `1px solid ${C.ink}`, borderRadius: 10, background: C.ink, color: '#FFF', cursor: workflowRunning ? 'default' : 'pointer', fontSize: '0.8125rem', fontWeight: 800, opacity: workflowRunning ? 0.7 : 1 }}
          >
            {workflowRunning ? 'Opening Creative Nodes' : 'Approve Selected Angle'}
          </button>
        )}
      </div>

      <div style={{ background: C.faint, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
        <p style={{ margin: 0, color: C.muted, fontSize: '0.8125rem', lineHeight: 1.5 }}>
          Only this selected angle continues into the creative nodes. The other generated angles stay as alternatives until you select and save one.
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Creative Preview Panel
// ════════════════════════════════════════════════════════════════════════════
function CreativePreviewPanel({
  sprint,
  channel: panelChannel,
  creativeDraft,
  onCreativeDraftChange,
  onSprintPatched,
  onContinue,
  workflowRunning,
}: {
  sprint?: SprintRecord | null;
  channel?: string;
  creativeDraft?: CreativeDraft;
  onCreativeDraftChange?: (draft: CreativeDraft) => void;
  onSprintPatched?: (rawSprint: unknown) => void;
  onContinue?: (sprintId: string) => void;
  workflowRunning?: boolean;
}) {
  const angles = sprint?.angles?.angles ?? [];
  const [selectedId, setSelectedId] = useState<Angle['id']>('angle_A');
  const [channel, setChannel] = useState<Platform>((panelChannel ?? sprint?.active_channels?.[0] ?? 'meta') as Platform);
  const [brandName, setBrandName] = useState('Your Brand');
  const [image, setImage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Angle>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const savedSelected = (sprint?.angles as { selected_angle_id?: Angle['id'] } | undefined)?.selected_angle_id;
    if (savedSelected) setSelectedId(savedSelected);
  }, [sprint?.angles]);

  useEffect(() => {
    if (panelChannel) setChannel(panelChannel as Platform);
  }, [panelChannel]);

  const selected = drafts[selectedId] ?? creativeDraft?.angle ?? angles.find((angle) => angle.id === selectedId) ?? angles[0];
  const channels = (sprint?.active_channels?.length ? sprint.active_channels : ['meta', 'google', 'linkedin', 'tiktok']) as Platform[];
  const lockedChannel = (panelChannel && channels.includes(panelChannel as Platform)) ? panelChannel as Platform : undefined;
  const activeChannel = lockedChannel ?? (channels.includes(channel) ? channel : channels[0]);
  const copy = selected?.copy[activeChannel];
  const creativeAssets = (sprint?.angles as { creative_assets?: Partial<Record<Platform, { brand_name?: string; image?: string | null }>> } | undefined)?.creative_assets;
  const savedChannels = channels.filter((item) => Boolean(creativeAssets?.[item]));
  const allChannelsSaved = channels.length > 0 && savedChannels.length === channels.length;

  useEffect(() => {
    const saved = creativeAssets?.[activeChannel];
    setBrandName(creativeDraft?.brandName ?? saved?.brand_name ?? 'Your Brand');
    setImage(creativeDraft?.image ?? saved?.image ?? null);
  }, [activeChannel, creativeDraft?.brandName, creativeDraft?.image, creativeAssets]);

  useEffect(() => {
    if (!selected || !copy) return;
    onCreativeDraftChange?.({
      channel: activeChannel,
      angleId: selected.id,
      angle: selected,
      brandName,
      image,
    });
  }, [activeChannel, brandName, copy, image, onCreativeDraftChange, selected]);

  if (!angles.length || !selected || !copy) {
    return <p style={{ color: C.muted, fontSize: '0.875rem' }}>Creative previews appear after AngleAgent generates copy.</p>;
  }

  const updateCopy = (field: string, value: string) => {
    setDrafts((prev) => {
      const base = prev[selected.id] ?? selected;
      return {
        ...prev,
        [selected.id]: {
          ...base,
          copy: {
            ...base.copy,
            [activeChannel]: {
              ...base.copy[activeChannel],
              [field]: value,
            },
          },
        },
      };
    });
  };

  const saveCreative = async () => {
    if (!sprint?.angles) return;
    setSaving(true);
    setMessage(null);
    try {
      const editedAngles = sprint.angles.angles.map((angle) => drafts[angle.id] ?? angle);
      const res = await fetch(`/api/sprint/${sprint.sprint_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          angles: {
            ...sprint.angles,
            selected_angle_id: selected.id,
            creative_assets: {
              ...creativeAssets,
              [activeChannel]: { brand_name: brandName, image },
            },
            angles: editedAngles,
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json().catch(() => null) as { sprint?: unknown } | null;
      if (data?.sprint) onSprintPatched?.(data.sprint);
      setMessage(`${activeChannel} creative saved.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const renderCopyEditor = () => {
    const field = (label: string, key: string, value: string, limit: number, multiline = false) => (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <Label>{label}</Label>
          <span style={{ color: value.length > limit ? C.warn : C.muted, fontSize: '0.6875rem', fontFamily: 'monospace' }}>{value.length}/{limit}</span>
        </div>
        {multiline ? (
          <textarea value={value} onChange={(event) => updateCopy(key, event.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box', resize: 'none', border: `1px solid ${value.length > limit ? C.warn : C.border}`, borderRadius: 10, background: C.canvas, color: C.ink, padding: '9px 10px', fontSize: '0.8125rem', outline: 'none' }} />
        ) : (
          <input value={value} onChange={(event) => updateCopy(key, event.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${value.length > limit ? C.warn : C.border}`, borderRadius: 10, background: C.canvas, color: C.ink, padding: '9px 10px', fontSize: '0.8125rem', outline: 'none' }} />
        )}
      </div>
    );

    if (activeChannel === 'meta') {
      const meta = copy as Angle['copy']['meta'];
      return <>{field('Headline', 'headline', meta.headline, 40)}{field('Body', 'body', meta.body, 125, true)}</>;
    }
    if (activeChannel === 'google') {
      const google = copy as Angle['copy']['google'];
      return <>{field('Headline 1', 'headline1', google.headline1, 30)}{field('Headline 2', 'headline2', google.headline2, 30)}{field('Description', 'description', google.description, 90, true)}</>;
    }
    if (activeChannel === 'linkedin') {
      const linkedin = copy as Angle['copy']['linkedin'];
      return <>{field('Intro', 'intro', linkedin.intro, 70)}{field('Headline', 'headline', linkedin.headline, 25)}{field('Body', 'body', linkedin.body, 150, true)}</>;
    }
    const tiktok = copy as Angle['copy']['tiktok'];
    return <>{field('Hook', 'hook', tiktok.hook, 100, true)}{field('Overlay', 'overlay', tiktok.overlay, 80)}</>;
  };

  return (
    <div>
      <SectionTitle>Creative · {activeChannel}</SectionTitle>
      <p style={{ color: C.muted, fontSize: '0.875rem', marginBottom: 14 }}>Edit the selected angle for this channel. The preview updates directly inside the canvas node in real time.</p>
      <div style={{ background: C.ink, color: '#FFF', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
        <Label><span style={{ color: '#FFFFFF80' }}>Selected Angle</span></Label>
        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800 }}>{selected.id.replace('angle_', '')} · {selected.archetype}</p>
      </div>
      {!lockedChannel && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {channels.map((item) => (
            <button key={item} onClick={() => setChannel(item)} style={{ height: 30, padding: '0 10px', border: `1px solid ${activeChannel === item ? C.ink : C.border}`, borderRadius: 8, background: activeChannel === item ? C.ink : C.surface, color: activeChannel === item ? '#FFF' : C.muted, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>{item}</button>
          ))}
        </div>
      )}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <Label>Brand</Label>
        <input value={brandName} onChange={(event) => setBrandName(event.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 10, background: C.canvas, color: C.ink, padding: '9px 10px', fontSize: '0.8125rem', outline: 'none', marginBottom: 10 }} />
        <Label>Creative Image</Label>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, border: `1px dashed ${C.border}`, borderRadius: 10, background: C.canvas, color: C.ink, cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 800 }}>
          {image ? 'Replace Uploaded Image' : 'Upload Image'}
          <input type="file" accept="image/*" onChange={uploadImage} style={{ display: 'none' }} />
        </label>
        {image && <button type="button" onClick={() => setImage(null)} style={{ marginTop: 8, height: 30, border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.muted, cursor: 'pointer', fontSize: '0.75rem' }}>Remove image</button>}
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {renderCopyEditor()}
        <button onClick={saveCreative} disabled={saving} style={{ height: 36, border: 'none', borderRadius: 10, background: C.ink, color: '#FFF', fontSize: '0.8125rem', fontWeight: 800, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving Creative' : `Save ${activeChannel} Creative`}
        </button>
        {message && <p style={{ margin: 0, color: message.includes('saved') ? C.ink : C.stop, fontSize: '0.75rem' }}>{message}</p>}
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
        <Label>Creative Gate</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0 12px' }}>
          {channels.map((item) => {
            const saved = Boolean(creativeAssets?.[item]);
            return (
              <span key={item} style={{ border: `1px solid ${saved ? C.ink : C.border}`, borderRadius: 999, padding: '4px 8px', background: saved ? C.ink : C.faint, color: saved ? '#FFF' : C.muted, fontSize: '0.6875rem', fontWeight: 800, textTransform: 'capitalize' }}>
                {item} {saved ? 'saved' : 'pending'}
              </span>
            );
          })}
        </div>
        <button
          onClick={() => sprint && onContinue?.(sprint.sprint_id)}
          disabled={!allChannelsSaved || workflowRunning}
          style={{ width: '100%', height: 38, border: `1px solid ${allChannelsSaved ? C.ink : C.border}`, borderRadius: 10, background: allChannelsSaved ? C.ink : C.faint, color: allChannelsSaved ? '#FFF' : C.muted, cursor: allChannelsSaved && !workflowRunning ? 'pointer' : 'default', fontSize: '0.8125rem', fontWeight: 900, opacity: workflowRunning ? 0.7 : 1 }}
        >
          {workflowRunning ? 'Running Demo Workflow' : allChannelsSaved ? 'Run Demo Workflow' : `Save ${channels.length - savedChannels.length} More Creative${channels.length - savedChannels.length === 1 ? '' : 's'}`}
        </button>
        <p style={{ margin: '8px 0 0', color: C.muted, fontSize: '0.75rem', lineHeight: 1.45 }}>
          Demo mode will generate campaign results, verdict, landing page, and report from the selected angle.
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Landing Panel
// ════════════════════════════════════════════════════════════════════════════
function LandingPanel({
  sprint,
  landingDraft,
  onLandingDraftChange,
}: {
  sprint?: SprintRecord | null;
  landingDraft?: LandingDraft | null;
  onLandingDraftChange?: (draft: LandingDraft) => void;
}) {
  const landing = sprint?.landing;
  const angles = sprint?.angles?.angles ?? [];
  const selectedAngleId = (sprint?.angles as { selected_angle_id?: string } | undefined)?.selected_angle_id;
  const firstAngle = angles.find((angle) => angle.id === selectedAngleId) ?? angles[0];
  const firstPage = landing?.pages?.[0];
  const [mode, setMode] = useState<LandingDraft['mode']>(landingDraft?.mode ?? 'builder');
  const [theme, setTheme] = useState(landingDraft?.theme ?? 'studio');
  const [eyebrow, setEyebrow] = useState(landingDraft?.eyebrow ?? 'LaunchLense validation sprint');
  const [headline, setHeadline] = useState(landingDraft?.headline ?? firstPage?.sections?.[0]?.headline ?? firstAngle?.copy.meta.headline ?? '');
  const [subheadline, setSubheadline] = useState(landingDraft?.subheadline ?? firstPage?.sections?.[0]?.subheadline ?? firstAngle?.copy.meta.body ?? '');
  const [cta, setCta] = useState(landingDraft?.cta ?? firstPage?.sections?.[0]?.cta_label ?? firstAngle?.cta ?? 'Join Waitlist');
  const [audience, setAudience] = useState(landingDraft?.audience ?? sprint?.genome?.icp ?? 'Early teams validating demand before they build');
  const [offer, setOffer] = useState(landingDraft?.offer ?? sprint?.idea ?? 'A focused validation sprint that turns market interest into a decision');
  const [proofOne, setProofOne] = useState(landingDraft?.proof?.[0] ?? firstPage?.sections?.[1]?.bullets?.[0] ?? 'Validated through a structured 48-hour market sprint.');
  const [proofTwo, setProofTwo] = useState(landingDraft?.proof?.[1] ?? firstPage?.sections?.[1]?.bullets?.[1] ?? 'Channel-normalized verdicts remove platform bias.');
  const [proofThree, setProofThree] = useState(landingDraft?.proof?.[2] ?? firstPage?.sections?.[1]?.bullets?.[2] ?? 'Angle isolation shows which message to build around.');
  const [testimonial, setTestimonial] = useState(landingDraft?.testimonial ?? firstPage?.sections?.[3]?.quote ?? 'This gives us a decision, not another dashboard.');
  const [formTitle, setFormTitle] = useState(landingDraft?.formTitle ?? 'Join the validation list');
  const [formSubtext, setFormSubtext] = useState(landingDraft?.formSubtext ?? 'Get early access when this offer opens.');
  const [customHtml, setCustomHtml] = useState(landingDraft?.customHtml ?? '');
  const [customCss, setCustomCss] = useState(landingDraft?.customCss ?? '');
  const [deploying, setDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(firstPage && 'url' in firstPage ? String(firstPage.url) : null);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);

  const draft: LandingDraft = {
    mode,
    theme,
    eyebrow,
    headline,
    subheadline,
    cta,
    audience,
    offer,
    proof: [proofOne, proofTwo, proofThree],
    testimonial,
    formTitle,
    formSubtext,
    customHtml,
    customCss,
  };

  useEffect(() => {
    onLandingDraftChange?.(draft);
  }, [mode, theme, eyebrow, headline, subheadline, cta, audience, offer, proofOne, proofTwo, proofThree, testimonial, formTitle, formSubtext, customHtml, customCss, onLandingDraftChange]);

  const html = buildLandingHtml({
    ...draft,
    sprintId: sprint?.sprint_id ?? 'preview',
  });

  const handleDeploy = async () => {
    if (!sprint) return;
    setDeploying(true);
    setDeployMessage(null);
    try {
      const res = await fetch('/api/lp/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprint_id: sprint.sprint_id, html, gjsData: { landingDraft: draft } }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) as { url?: string; error?: string } : {};
      if (!res.ok) throw new Error(data.error ?? 'Deploy failed');
      setDeployedUrl(data.url ?? `/lp/${sprint.sprint_id}`);
      setDeployMessage('Landing page deployed and saved to sprint.');
    } catch (err) {
      setDeployMessage(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div>
      <SectionTitle>Landing Page</SectionTitle>
      {!landing?.pages?.length && !angles.length && (
        <p style={{ color: C.muted, fontSize: '0.875rem', marginBottom: 14 }}>Landing pages are generated after the demo workflow completes.</p>
      )}
      <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: 16 }}>
        Build a polished single-page offer from the winning angle. The canvas node previews this draft before it is deployed.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.92fr) minmax(340px, 1.08fr)', gap: 14, alignItems: 'start' }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <Label>Editor Mode</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { id: 'builder', label: 'Builder' },
                { id: 'code', label: 'HTML/CSS' },
              ].map((item) => (
                <button key={item.id} onClick={() => setMode(item.id as LandingDraft['mode'])} style={{ height: 32, border: `1px solid ${mode === item.id ? C.ink : C.border}`, borderRadius: 9, background: mode === item.id ? C.ink : C.canvas, color: mode === item.id ? '#FFF' : C.muted, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800 }}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {mode === 'builder' ? (
            <>
              <div>
                <Label>Visual System</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {[
                    { id: 'studio', label: 'Studio' },
                    { id: 'editorial', label: 'Editorial' },
                    { id: 'signal', label: 'Signal' },
                  ].map((item) => (
                    <button key={item.id} onClick={() => setTheme(item.id)} style={{ height: 32, border: `1px solid ${theme === item.id ? C.ink : C.border}`, borderRadius: 9, background: theme === item.id ? C.ink : C.canvas, color: theme === item.id ? '#FFF' : C.muted, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800 }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <LandingInput label="Eyebrow" value={eyebrow} onChange={setEyebrow} />
              <LandingInput label="Hero Headline" value={headline} onChange={setHeadline} />
              <LandingInput label="Subheadline" value={subheadline} onChange={setSubheadline} multiline />
              <LandingInput label="CTA" value={cta} onChange={setCta} />
              <LandingInput label="Audience" value={audience} onChange={setAudience} multiline />
              <LandingInput label="Offer Mechanism" value={offer} onChange={setOffer} multiline />
              <LandingInput label="Proof 1" value={proofOne} onChange={setProofOne} />
              <LandingInput label="Proof 2" value={proofTwo} onChange={setProofTwo} />
              <LandingInput label="Proof 3" value={proofThree} onChange={setProofThree} />
              <LandingInput label="Testimonial / Signal Quote" value={testimonial} onChange={setTestimonial} multiline />
              <LandingInput label="Form Title" value={formTitle} onChange={setFormTitle} />
              <LandingInput label="Form Subtext" value={formSubtext} onChange={setFormSubtext} multiline />
            </>
          ) : (
            <>
              <LandingInput label="Custom HTML Body" value={customHtml} onChange={setCustomHtml} multiline rows={10} />
              <LandingInput label="Custom CSS" value={customCss} onChange={setCustomCss} multiline rows={10} />
              <p style={{ margin: 0, color: C.muted, fontSize: '0.75rem', lineHeight: 1.45 }}>
                Paste body HTML and CSS only. LaunchLense wraps it in a fast single-file page for deploy.
              </p>
            </>
          )}
          <button onClick={handleDeploy} disabled={deploying} style={{ height: 38, border: 'none', borderRadius: 10, background: C.ink, color: '#FFF', fontWeight: 800, cursor: deploying ? 'default' : 'pointer', opacity: deploying ? 0.7 : 1 }}>
            {deploying ? 'Deploying' : deployedUrl ? 'Redeploy Landing Page' : 'Deploy Landing Page'}
          </button>
          {deployedUrl && <a href={deployedUrl} target="_blank" rel="noreferrer" style={{ color: C.ink, fontSize: '0.8125rem', fontWeight: 700 }}>{deployedUrl}</a>}
          {deployMessage && <p style={{ margin: 0, color: deployMessage.startsWith('Landing') ? C.go : C.stop, fontSize: '0.75rem' }}>{deployMessage}</p>}
        </div>
        <div style={{ position: 'sticky', top: 0, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', background: '#FFF' }}>
          <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.6875rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Preview</span>
            <span style={{ fontSize: '0.6875rem', color: C.muted }}>{mode === 'code' ? 'Custom HTML/CSS' : 'Builder'}</span>
          </div>
          <iframe title="Landing page preview" srcDoc={html} style={{ width: '100%', height: 640, border: 0, display: 'block' }} />
        </div>
      </div>
    </div>
  );
}

function LandingInput({ label, value, onChange, multiline = false, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; rows?: number }) {
  return (
    <div>
      <Label>{label}</Label>
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', border: `1px solid ${C.border}`, borderRadius: 10, background: C.canvas, color: C.ink, padding: '9px 10px', fontSize: '0.8125rem', outline: 'none', fontFamily: rows > 4 ? 'monospace' : 'inherit' }} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 10, background: C.canvas, color: C.ink, padding: '9px 10px', fontSize: '0.8125rem', outline: 'none' }} />
      )}
    </div>
  );
}

function buildLandingHtml({
  mode,
  theme,
  eyebrow,
  headline,
  subheadline,
  cta,
  audience,
  offer,
  proof,
  testimonial,
  formTitle,
  formSubtext,
  customHtml,
  customCss,
  sprintId,
}: LandingDraft & { sprintId: string }) {
  const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  if (mode === 'code') {
    const fallback = `<main style="max-width:960px;margin:0 auto;padding:72px 24px"><p style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#8C8880;font-weight:800">Custom landing page</p><h1 style="font-size:64px;line-height:.95;letter-spacing:-.06em">${esc(headline || 'Paste custom HTML')}</h1><p style="color:#8C8880;font-size:18px;line-height:1.7">${esc(subheadline || 'Use the HTML/CSS editor to create a custom page.')}</p></main>`;
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(headline || 'LaunchLense Landing Page')}</title><meta name="robots" content="noindex,nofollow"><style>:root{--canvas:#FAFAF8;--surface:#FFFFFF;--border:#E8E4DC;--ink:#111110;--muted:#8C8880;--faint:#F3F0EB}*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}${customCss}</style></head><body>${customHtml || fallback}</body></html>`;
  }
  const proofCards = proof.filter(Boolean).map((bullet, index) => `<article class="proof-card"><span>${index + 1}</span><p>${esc(bullet)}</p></article>`).join('');
  const darkHero = theme === 'editorial';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(headline || 'LaunchLense Landing Page')}</title><meta name="robots" content="noindex,nofollow"><style>:root{--canvas:#FAFAF8;--surface:#FFFFFF;--border:#E8E4DC;--ink:#111110;--muted:#8C8880;--faint:#F3F0EB}*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}.wrap{max-width:1180px;margin:0 auto;padding:28px 22px 72px}.nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:36px}.brand{font-weight:900;letter-spacing:-.04em}.badge,.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:900}.hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);gap:28px;align-items:stretch}.panel{border:1px solid var(--border);border-radius:22px;background:var(--surface);padding:28px}.hero-copy{padding:38px;border-radius:24px;border:1px solid ${darkHero ? '#242424' : 'var(--border)'};background:${darkHero ? 'var(--ink)' : 'var(--surface)'};color:${darkHero ? '#FFF' : 'var(--ink)'}}.hero-copy p{color:${darkHero ? '#FFFFFFB3' : 'var(--muted)'}}h1{font-size:clamp(44px,7vw,88px);line-height:.9;letter-spacing:-.075em;margin:12px 0 18px;max-width:900px}p{font-size:17px;line-height:1.65;color:var(--muted)}.cta{display:inline-flex;align-items:center;justify-content:center;margin-top:22px;min-height:48px;padding:0 22px;border-radius:999px;background:${theme === 'signal' ? 'var(--surface)' : 'var(--ink)'};color:${theme === 'signal' ? 'var(--ink)' : '#FFF'};border:1px solid ${theme === 'signal' ? 'var(--border)' : 'var(--ink)'};text-decoration:none;font-weight:900}.signal{display:grid;gap:12px}.metric{background:${theme === 'signal' ? 'var(--ink)' : 'var(--faint)'};color:${theme === 'signal' ? '#FFF' : 'var(--ink)'};border-radius:18px;padding:18px}.metric strong{display:block;font-size:34px;letter-spacing:-.04em}.sections{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}.proof{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:22px}.proof-card{border:1px solid var(--border);border-radius:18px;background:var(--surface);padding:18px}.proof-card span{display:grid;place-items:center;width:26px;height:26px;border-radius:99px;background:var(--ink);color:#FFF;font-size:12px;font-weight:900;margin-bottom:12px}.quote{margin-top:22px;border-radius:22px;background:var(--ink);color:#FFF;padding:26px}.quote p{color:#FFFFFFCC;font-size:20px}.form{display:grid;gap:10px;margin-top:18px}.form input{height:46px;border:1px solid var(--border);border-radius:12px;padding:0 14px;background:var(--surface);font:inherit}.form button{height:46px;border:0;border-radius:12px;background:var(--ink);color:#FFF;font-weight:900;font:inherit}.footer{margin-top:32px;color:var(--muted);font-size:12px}@media(max-width:860px){.hero,.sections,.proof{grid-template-columns:1fr}h1{font-size:48px}}</style></head><body><main class="wrap"><nav class="nav"><div class="brand">${esc(offer.slice(0, 32) || 'LaunchLense')}</div><div class="badge">Sprint ${esc(sprintId.slice(0, 8))}</div></nav><section class="hero"><div class="hero-copy"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(headline)}</h1><p>${esc(subheadline)}</p><a class="cta" href="#signup">${esc(cta)}</a></div><aside class="panel signal"><div class="metric"><span class="badge">Audience</span><strong>${esc(audience.split(' ').slice(0, 5).join(' '))}</strong><p>${esc(audience)}</p></div><div class="metric"><span class="badge">Mechanism</span><p>${esc(offer)}</p></div></aside></section><section class="proof">${proofCards}</section><section class="sections"><div class="quote"><div class="eyebrow">Demand signal</div><p>"${esc(testimonial)}"</p></div><div id="signup" class="panel"><div class="eyebrow">Early access</div><h2>${esc(formTitle)}</h2><p>${esc(formSubtext)}</p><form class="form"><input placeholder="you@company.com" type="email"><button>${esc(cta)}</button></form></div></section><p class="footer">Built with LaunchLense. Pixel and UTM attribution are locked at deploy time.</p></main></body></html>`;
}

// ════════════════════════════════════════════════════════════════════════════
// Campaign Panel (live metrics)
// ════════════════════════════════════════════════════════════════════════════
function CampaignPanel({
  sprint,
  channel,
  onEditSetup,
  onSprintPatched,
}: {
  sprint?: SprintRecord | null;
  channel?: string;
  onEditSetup: (id: string) => void;
  onSprintPatched?: (rawSprint: unknown) => void;
}) {
  const channels = (sprint?.active_channels?.length ? sprint.active_channels : ['meta', 'google', 'linkedin', 'tiktok']) as Platform[];
  const [launching, setLaunching] = useState(false);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);

  const startCampaign = async () => {
    if (!sprint) return;
    setLaunching(true);
    setLaunchMessage(null);
    try {
      const res = await fetch(`/api/sprint/${sprint.sprint_id}/campaign/start`, { method: 'POST' });
      const data = await res.json().catch(() => null) as { sprint?: unknown; error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? 'Campaign launch failed');
      if (data?.sprint) onSprintPatched?.(data.sprint);
      setLaunchMessage('Campaign deployed. The 48-hour monitoring window is now running.');
    } catch (err) {
      setLaunchMessage(err instanceof Error ? err.message : 'Campaign launch failed');
    } finally {
      setLaunching(false);
    }
  };

  const renderChannel = (ch: Platform) => {
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
          <div style={{ display: 'flex', gap: 8 }}>
            {sprint.state === 'ANGLES_DONE' && (
              <button
                onClick={startCampaign}
                disabled={launching}
                style={{ height: 28, padding: '0 10px', border: `1px solid ${C.ink}`, background: C.ink, borderRadius: 8, fontSize: '0.8125rem', color: '#FFF', cursor: launching ? 'default' : 'pointer', opacity: launching ? 0.7 : 1 }}
              >
                {launching ? 'Deploying' : 'Deploy Channels'}
              </button>
            )}
            <button
              onClick={() => onEditSetup(sprint.sprint_id)}
              style={{ height: 28, padding: '0 10px', border: `1px solid ${C.border}`, background: 'transparent', borderRadius: 8, fontSize: '0.8125rem', color: C.muted, cursor: 'pointer' }}
            >
              Edit Setup
            </button>
          </div>
        )}
      </div>
      {launchMessage && <p style={{ margin: '0 0 12px', color: launchMessage.startsWith('Campaign deployed') ? C.ink : C.stop, fontSize: '0.8125rem' }}>{launchMessage}</p>}
      {channel
        ? renderChannel(channel as Platform)
        : channels.map(renderChannel)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Verdict Panel
// ════════════════════════════════════════════════════════════════════════════
function VerdictPanel({ sprint }: { sprint?: SprintRecord | null }) {
  const v = sprint?.verdict;
  if (!v) return <p style={{ color: C.muted, fontSize: '0.875rem' }}>Verdict not yet generated.</p>;

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
export function NodePanel({
  panel,
  channel,
  sprint,
  onClose,
  onEditSetup,
  onRunWorkflow,
  onContinueAfterAngles,
  onContinueAfterCreatives,
  creativeDraft,
  onCreativeDraftChange,
  landingDraft,
  onLandingDraftChange,
  onSprintPatched,
  workflowRunning = false,
  embedded = false,
}: Props) {
  if (!panel) return null;
  const panelWidth = panel === 'landing' ? 820 : 380;

  const content = () => {
    switch (panel) {
      case 'accounts':   return <AccountsPanel />;
      case 'genome':     return <GenomePanel sprint={sprint} />;
      case 'healthgate': return <HealthgatePanel sprint={sprint} channel={channel} />;
      case 'angles':     return <AnglesPanel sprint={sprint} onContinue={onContinueAfterAngles} onSprintPatched={onSprintPatched} workflowRunning={workflowRunning} />;
      case 'creative':   return <CreativePreviewPanel sprint={sprint} channel={channel} creativeDraft={creativeDraft} onCreativeDraftChange={onCreativeDraftChange} onSprintPatched={onSprintPatched} onContinue={onContinueAfterCreatives} workflowRunning={workflowRunning} />;
      case 'landing':    return <LandingPanel sprint={sprint} landingDraft={landingDraft} onLandingDraftChange={onLandingDraftChange} />;
      case 'campaign':   return <CampaignPanel sprint={sprint} channel={channel} onEditSetup={onEditSetup} onSprintPatched={onSprintPatched} />;
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
          position: embedded ? 'relative' : 'absolute',
          top: embedded ? 'auto' : 48,
          right: embedded ? 'auto' : 0,
          bottom: embedded ? 'auto' : 0,
          width: panelWidth,
          maxHeight: embedded ? 'calc(100vh - 88px)' : undefined,
          background: C.canvas,
          border: embedded ? `1px solid ${C.border}` : undefined,
          borderLeft: embedded ? `1px solid ${C.border}` : `1px solid ${C.border}`,
          borderRadius: embedded ? 16 : 0,
          zIndex: 20,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: embedded ? '0 1px 2px rgba(0,0,0,0.06)' : undefined,
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
          {sprint && sprint.state !== 'COMPLETE' && onRunWorkflow && (
            <button
              onClick={() => onRunWorkflow(sprint.sprint_id)}
              disabled={workflowRunning}
              style={{ height: 30, padding: '0 12px', border: `1px solid ${workflowRunning ? C.ink : 'transparent'}`, borderRadius: 9, background: workflowRunning ? C.faint : C.ink, color: workflowRunning ? C.ink : '#FFF', cursor: workflowRunning ? 'default' : 'pointer', fontSize: '0.75rem', fontWeight: 700, opacity: workflowRunning ? 1 : 1 }}
            >
              {workflowRunning ? 'Running Agents' : workflowActionLabel(sprint)}
            </button>
          )}
          <button
            onClick={onClose}
            style={{ height: 28, padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', color: C.muted, fontSize: '0.75rem' }}
            aria-label="Close panel"
          >
            Close
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
