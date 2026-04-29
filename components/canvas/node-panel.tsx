'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Table2, Mail } from 'lucide-react';
import { useAppStore, type PlatformId, type ConnectedPlatform } from '@/lib/store';
import type {
  Angle,
  Platform,
  SprintEventLogEntry,
  SprintRecord,
  SpreadsheetContactRow,
  SpreadsheetAgentOutput,
} from '@/lib/agents/types';
import { buildOutreachCopy } from '@/lib/agents/outreach-agent';

const C = {
  ink: '#111110', muted: '#8C8880', border: '#E8E4DC',
  surface: '#FFFFFF', canvas: '#FAFAF8', faint: '#F3F0EB',
  go: '#111110', warn: '#8C8880', stop: '#DC2626',
};

export type PanelId =
  | 'accounts' | 'genome' | 'healthgate' | 'angles'
  | 'creative' | 'landing' | 'campaign' | 'verdict' | 'report'
  | 'integrations'
  /** Dedicated containers opened from canvas nodes — not the toolbar integrations overview */
  | 'integrations_sheet'
  | 'integrations_outreach'
  | 'integrations_slack'
  | 'benchmarks' | 'settings' | null;

/** Scroll nested panel body explicitly (`scrollIntoView` misses inner overflow containers under motion wrappers). */
function scrollIntoScrollParent(scrollParent: HTMLElement, target: HTMLElement, paddingTop = 14) {
  const pRect = scrollParent.getBoundingClientRect();
  const tRect = target.getBoundingClientRect();
  const nextTop = tRect.top - pRect.top + scrollParent.scrollTop - paddingTop;
  scrollParent.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
}

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

type ReviewedContact = SpreadsheetContactRow & {
  selected: boolean;
};

interface Props {
  panel:       PanelId;
  /** Ads/creative channel key (meta, google, …) */
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

function describeGenomeLogEntry(entry: SprintEventLogEntry): string {
  const p = entry.payload ?? {};
  if (entry.event_type === 'started') {
    const idea = typeof p.idea === 'string' ? p.idea : '';
    const short = idea.length > 96 ? `${idea.slice(0, 96)}…` : idea;
    return short ? `Queued · ${short}` : 'Queued';
  }
  if (entry.event_type === 'completed') {
    const sig = p.signal != null ? String(p.signal) : '?';
    const comp = typeof p.composite === 'number' ? p.composite : '?';
    const ds =
      p.data_source === 'real' ? ' · live signals' : p.data_source === 'llm_estimate' ? ' · LLM estimate' : '';
    return `Finished · signal ${sig}, composite ${comp}/100${ds}`;
  }
  if (entry.event_type === 'blocked') {
    const br = typeof p.blocked_reason === 'string' ? p.blocked_reason : '';
    const short = br.length > 140 ? `${br.slice(0, 140)}…` : br;
    return short ? `Blocked · ${short}` : 'Blocked';
  }
  return `${entry.event_type}`;
}

function GenomeAgentActivityLog({ events }: { events?: SprintEventLogEntry[] | null }) {
  const lines = (events ?? [])
    .filter((e) => e.agent === 'genome')
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (lines.length === 0) return null;

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
      <div
        style={{
          fontWeight: 700,
          fontSize: '0.6875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: C.muted,
          marginBottom: 8,
        }}
      >
        GenomeAgent activity
      </div>
      <div
        role="log"
        style={{
          maxHeight: 220,
          overflowY: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.6875rem',
          lineHeight: 1.55,
          color: C.ink,
        }}
      >
        {lines.map((e, idx) => (
          <div key={`${e.created_at}-${e.event_type}-${idx}`} style={{ marginBottom: 6 }}>
            <span style={{ color: C.muted }}>[{formatGenomeLogTime(e.created_at)}]</span>{' '}
            <span style={{ fontWeight: 600 }}>{e.event_type}</span> · {describeGenomeLogEntry(e)}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatGenomeLogTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

function genomeNarrativeBlock(title: string, body: string) {
  if (!body.trim()) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <Label>{title}</Label>
      <p style={{ fontSize: '0.8125rem', color: C.ink, margin: '6px 0 0', lineHeight: 1.5 }}>{body}</p>
    </div>
  );
}

function GenomePanel({ sprint }: { sprint?: SprintRecord | null }) {
  const g = sprint?.genome;
  const genomeEventsEmpty = !(sprint?.events ?? []).some((e) => e.agent === 'genome');

  if (!g) {
    return (
      <div>
        <p style={{ color: C.muted, fontSize: '0.875rem', marginBottom: 12 }}>Genome has not run yet for this sprint.</p>
        {!genomeEventsEmpty && <GenomeAgentActivityLog events={sprint?.events} />}
      </div>
    );
  }

  const axes = [
    { key: 'demand' as const, label: 'Demand', w: '30%' },
    { key: 'icp' as const, label: 'ICP', w: '25%' },
    { key: 'competition' as const, label: 'Competition', w: '20%' },
    { key: 'timing' as const, label: 'Timing', w: '15%' },
    { key: 'moat' as const, label: 'Moat', w: '10%' },
  ];

  const sg = g.source_google;
  const sm = g.source_meta;
  const realSignals = g.data_source === 'real';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <SectionTitle>Genome Analysis</SectionTitle>
        <Pill value={g.signal} />
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            padding: '4px 8px',
            borderRadius: 6,
            background: realSignals ? '#ECFDF5' : '#FFFBEB',
            color: realSignals ? C.go : '#B45309',
            border: `1px solid ${realSignals ? `${C.go}35` : '#FDE68A'}`,
          }}
        >
          {realSignals ? 'Live search signals' : 'LLM estimate (APIs unavailable)'}
        </span>
        <span style={{ fontSize: '0.6875rem', color: C.muted }}>{(g.elapsed_ms / 1000).toFixed(1)}s run</span>
      </div>

      <p style={{ fontSize: '0.75rem', color: C.muted, lineHeight: 1.45, marginBottom: 14 }}>
        GenomeAgent runs a quick market pass: Google results (via SerpAPI when <code style={{ fontSize: '0.7rem' }}>SERPER_API_KEY</code> is set)
        and Meta Ad Library (when Meta app credentials exist). Those snippets feed the model; scores below interpret them.
      </p>

      <div style={{ background: C.ink, borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
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

      {(sg || sm || !realSignals) && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
          <Label>Observed signals (inputs to the model)</Label>
          {!realSignals && (
            <p style={{ fontSize: '0.75rem', color: '#B45309', margin: '8px 0 10px', lineHeight: 1.45 }}>
              No live SERP/Meta payloads — configure <code style={{ fontSize: '0.7rem' }}>SERPER_API_KEY</code> and Meta app env vars on the server for Google + Ad Library snapshots.
            </p>
          )}
          {sg ? (
            <div style={{ marginTop: 10, padding: '10px 12px', background: C.faint, borderRadius: 8, marginBottom: sm ? 10 : 0 }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: C.muted, marginBottom: 6 }}>Google (SerpAPI)</p>
              <p style={{ fontSize: '0.75rem', color: C.ink, margin: '0 0 6px', lineHeight: 1.45 }}>
                ~{sg.organic_result_count.toLocaleString()} indexed hits · {sg.google_ads_count} paid spots on SERP · Related:{' '}
                {sg.related_searches.length ? sg.related_searches.join(' · ') : '—'}
              </p>
              {sg.top_titles.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.72rem', color: C.muted, lineHeight: 1.45 }}>
                  {sg.top_titles.slice(0, 5).map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              )}
              {sg.top_snippet ? (
                <p style={{ fontSize: '0.72rem', color: C.ink, margin: '8px 0 0', fontStyle: 'italic', lineHeight: 1.45 }}>
                  Top snippet: {sg.top_snippet}
                </p>
              ) : null}
            </div>
          ) : realSignals ? (
            <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 8 }}>Google snapshot unavailable for this run.</p>
          ) : null}
          {sm ? (
            <div style={{ padding: '10px 12px', background: C.faint, borderRadius: 8 }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: C.muted, marginBottom: 6 }}>Meta Ad Library</p>
              {sm.error ? (
                <p style={{ fontSize: '0.75rem', color: C.stop, margin: 0 }}>{sm.error}</p>
              ) : (
                <>
                  <p style={{ fontSize: '0.75rem', color: C.ink, margin: '0 0 6px', lineHeight: 1.45 }}>
                    ~{sm.active_ads_count} active ads (sample){sm.active_ads_count >= 25 ? ' — cap reached (crowded niche)' : ''}
                  </p>
                  {sm.advertiser_names.length > 0 ? (
                    <p style={{ fontSize: '0.72rem', color: C.muted, margin: 0 }}>
                      Advertisers: {sm.advertiser_names.slice(0, 12).join(', ')}
                      {sm.advertiser_names.length > 12 ? '…' : ''}
                    </p>
                  ) : (
                    <p style={{ fontSize: '0.72rem', color: C.muted, margin: 0 }}>No named advertisers in sample (possible blue-ocean signal).</p>
                  )}
                </>
              )}
            </div>
          ) : realSignals ? (
            <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 8 }}>Meta Ad Library snapshot unavailable for this run.</p>
          ) : null}
        </div>
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
        <Label>Analysis</Label>
        {genomeNarrativeBlock('Ideal customer', g.icp)}
        {genomeNarrativeBlock('Problem', g.problem_statement)}
        {genomeNarrativeBlock('Solution wedge', g.solution_wedge)}
        {genomeNarrativeBlock('Market category', g.market_category)}
        {genomeNarrativeBlock('Unique mechanism', g.unique_mechanism)}
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

      {g.research_sources.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
          <Label>Cited sources</Label>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: '0.75rem', color: C.muted, lineHeight: 1.5 }}>
            {g.research_sources.map((src, i) => (
              <li key={i} style={{ wordBreak: 'break-word' }}>
                {/^https?:\/\//i.test(src.trim()) ? (
                  <a href={src.trim()} target="_blank" rel="noopener noreferrer" style={{ color: C.ink }}>
                    {src}
                  </a>
                ) : (
                  src
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {g.proceed_note && (
        <div style={{ background: '#ECFDF5', border: `1px solid ${C.go}30`, borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
          <Label><span style={{ color: C.go }}>Proceed Note</span></Label>
          <p style={{ fontSize: '0.875rem', color: C.ink, margin: '4px 0 0' }}>{g.proceed_note}</p>
        </div>
      )}
      {g.pivot_brief && (
        <div style={{ background: '#FEF2F2', border: `1px solid ${C.stop}30`, borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
          <Label><span style={{ color: C.stop }}>Pivot Brief</span></Label>
          <p style={{ fontSize: '0.875rem', color: C.ink, margin: '4px 0 0' }}>{g.pivot_brief}</p>
        </div>
      )}

      <GenomeAgentActivityLog events={sprint?.events} />
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

const MAX_INLINE_CREATIVE_IMAGE_CHARS = 250_000;

function compactCreativeImage(image: string | null | undefined): string | null {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith('data:') && image.length <= MAX_INLINE_CREATIVE_IMAGE_CHARS) return image;
  return null;
}

function compactCreativeAssets(
  assets: Partial<Record<Platform, { brand_name?: string; image?: string | null }>> | undefined,
  channel: Platform,
  asset: { brand_name: string; image: string | null },
): Partial<Record<Platform, { brand_name?: string; image?: string | null }>> {
  const next: Partial<Record<Platform, { brand_name?: string; image?: string | null }>> = {};

  for (const [key, value] of Object.entries(assets ?? {}) as Array<[
    Platform,
    { brand_name?: string; image?: string | null },
  ]>) {
    next[key] = {
      brand_name: value.brand_name,
      image: compactCreativeImage(value.image),
    };
  }

  next[channel] = {
    brand_name: asset.brand_name,
    image: compactCreativeImage(asset.image),
  };

  return next;
}

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

  const selected =
    drafts[selectedId] ??
    angles.find((angle) => angle.id === selectedId) ??
    creativeDraft?.angle ??
    angles[0];
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
      const nextCreativeAssets = compactCreativeAssets(creativeAssets, activeChannel, {
        brand_name: brandName,
        image,
      });
      const res = await fetch(`/api/sprint/${sprint.sprint_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          angles: {
            ...sprint.angles,
            selected_angle_id: selected.id,
            creative_assets: nextCreativeAssets,
            angles: editedAngles,
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json().catch(() => null) as { sprint?: unknown } | null;
      if (data?.sprint) onSprintPatched?.(data.sprint);
      setMessage(
        image && !compactCreativeImage(image)
          ? `${activeChannel} creative saved. Large image preview is kept local only.`
          : `${activeChannel} creative saved.`,
      );
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
          {workflowRunning ? 'Running Demo Workflow' : allChannelsSaved ? 'Run' : `Save ${channels.length - savedChannels.length} More Creative${channels.length - savedChannels.length === 1 ? '' : 's'}`}
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
        PDF Report
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
// Integrations — Gmail, Google Sheets, Slack (post-sprint orchestration)
// ════════════════════════════════════════════════════════════════════════════

/** Slack logo mark — lucide-react does not ship a Slack icon in all versions */
function SlackGlyph({ size = 22, color }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ color: color ?? 'currentColor', flexShrink: 0 }}>
      <path
        fill="currentColor"
        d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.522A2.527 2.527 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834V5.042zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.527 2.527 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.528 2.528 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.314A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
      />
    </svg>
  );
}

function parseCsvToRows(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return row;
  });
}

function contactsSessionKey(sprintId: string): string {
  return `ll_contacts_${sprintId}`;
}

function selectedContacts(rows: ReviewedContact[]): SpreadsheetContactRow[] {
  return rows
    .filter((row) => row.selected && row.email.trim())
    .map(({ selected: _selected, ...contact }) => contact);
}

function toReviewedContacts(contacts: SpreadsheetContactRow[]): ReviewedContact[] {
  return contacts.map((contact) => ({ ...contact, selected: true }));
}

function persistReviewedContacts(sprintId: string, rows: ReviewedContact[]) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(contactsSessionKey(sprintId), JSON.stringify(selectedContacts(rows)));
}

function personalizeTemplate(template: string, contact: SpreadsheetContactRow): string {
  const first = contact.firstName?.trim() || 'there';
  const company = contact.company?.trim() || 'your team';
  return template
    .replace(/\[firstName\]|\{firstName\}/gi, first)
    .replace(/\[company\]|\{company\}/gi, company);
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}

async function readJsonOrError(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text().catch(() => '');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text };
  }
}

const INTEGRATION_LOG_AGENTS = new Set(['spreadsheet', 'outreach', 'slack']);

function describeIntegrationLogEntry(entry: SprintEventLogEntry): string {
  const p = entry.payload ?? {};
  if (entry.agent === 'spreadsheet' && entry.event_type === 'completed') {
    const vc = typeof p.validContacts === 'number' ? p.validContacts : 0;
    const tr = typeof p.totalRows === 'number' ? p.totalRows : 0;
    const mode = p.live_sheet === true ? 'Live Sheet' : 'CSV';
    const icp = p.icpFilterApplied === true ? ' · ICP filter' : '';
    return `${mode}: ${vc} contacts ready (${tr} rows parsed)${icp}`;
  }
  if (entry.agent === 'outreach' && entry.event_type === 'completed') {
    const ts = typeof p.totalSent === 'number' ? p.totalSent : 0;
    const fail = typeof p.failed === 'number' ? p.failed : 0;
    return fail ? `Outreach sent ${ts} (${fail} failed)` : `Outreach sent ${ts}`;
  }
  if (entry.agent === 'slack') {
    if (entry.event_type === 'skipped') return 'Slack: skipped';
    return p.posted === true ? 'Slack: posted summary' : 'Slack: recorded';
  }
  return `${entry.agent} · ${entry.event_type}`;
}

function formatLogTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function SpreadsheetPrepSummaryCard({
  output,
}: {
  output: SpreadsheetAgentOutput | null | undefined;
}) {
  if (!output || typeof output.totalRows !== 'number') return null;
  const warn = output.warnings?.filter(Boolean) ?? [];
  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 10,
        background: 'rgba(250,250,248,0.08)',
        border: '1px solid rgba(250,250,248,0.14)',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: '0.75rem', color: '#FAFAF8', marginBottom: 10, letterSpacing: '0.02em' }}>
        SpreadsheetAgent result
      </div>
      <dl
        style={{
          margin: 0,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '6px 14px',
          fontSize: '0.75rem',
          color: 'rgba(250,250,248,0.88)',
          lineHeight: 1.45,
        }}
      >
        <dt style={{ color: 'rgba(250,250,248,0.55)', margin: 0 }}>Source</dt>
        <dd style={{ margin: 0 }}>{output.source}</dd>
        <dt style={{ color: 'rgba(250,250,248,0.55)', margin: 0 }}>Rows parsed</dt>
        <dd style={{ margin: 0 }}>{output.totalRows}</dd>
        <dt style={{ color: 'rgba(250,250,248,0.55)', margin: 0 }}>Valid contacts</dt>
        <dd style={{ margin: 0 }}>{output.validContacts}</dd>
        <dt style={{ color: 'rgba(250,250,248,0.55)', margin: 0 }}>Invalid email</dt>
        <dd style={{ margin: 0 }}>{output.skippedInvalidEmail}</dd>
        <dt style={{ color: 'rgba(250,250,248,0.55)', margin: 0 }}>Missing email cell</dt>
        <dd style={{ margin: 0 }}>{output.skippedNoEmail}</dd>
        {output.icpFilterApplied ? (
          <>
            <dt style={{ color: 'rgba(250,250,248,0.55)', margin: 0 }}>Filtered by ICP</dt>
            <dd style={{ margin: 0 }}>{output.filteredCount}</dd>
          </>
        ) : null}
      </dl>
      {warn.length > 0 ? (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: '0.72rem', color: '#FBBF24', lineHeight: 1.45 }}>
          {warn.map((w, i) => (
            <li key={`w-${i}`}>{w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function IntegrationAgentLog({
  events,
  variant,
}: {
  events?: SprintEventLogEntry[] | null;
  variant: 'sheet' | 'outreach';
}) {
  const lines = (events ?? [])
    .filter((e) => INTEGRATION_LOG_AGENTS.has(e.agent))
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (lines.length === 0) return null;

  const border =
    variant === 'sheet'
      ? '1px solid rgba(250,250,248,0.14)'
      : `1px solid ${C.border}`;

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: border,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: '0.6875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: variant === 'sheet' ? 'rgba(250,250,248,0.55)' : C.muted,
          marginBottom: 8,
        }}
      >
        Integration activity
      </div>
      <div
        role="log"
        style={{
          maxHeight: 200,
          overflowY: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.6875rem',
          lineHeight: 1.55,
          color: variant === 'sheet' ? 'rgba(250,250,248,0.82)' : C.ink,
        }}
      >
        {lines.map((e, idx) => (
          <div key={`${e.agent}-${e.created_at}-${e.event_type}-${idx}`} style={{ marginBottom: 6 }}>
            <span style={{ color: variant === 'sheet' ? 'rgba(250,250,248,0.45)' : C.muted }}>
              [{formatLogTime(e.created_at)}]
            </span>{' '}
            <span style={{ fontWeight: 600 }}>{e.agent}</span> · {describeIntegrationLogEntry(e)}
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationsPanel({
  sprint,
  variant,
  scrollParentRef,
  onSprintPatched,
}: {
  sprint?: SprintRecord | null;
  scrollParentRef?: React.RefObject<HTMLElement | null>;
  variant: 'overview' | 'sheet' | 'outreach' | 'slack';
  onSprintPatched?: (raw: unknown) => void;
}) {
  const [csvText, setCsvText] = useState(
    'email,first_name,company,role\nalice@example.com,Alice,Acme Inc,CEO\nbob@example.com,Bob,Beta Labs,Head of Growth\n',
  );
  const [icpFilter, setIcpFilter] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSpreadsheetPrep, setLastSpreadsheetPrep] = useState<SpreadsheetAgentOutput | null>(null);
  const [liveGoogleSheet, setLiveGoogleSheet] = useState(false);
  const [contactRows, setContactRows] = useState<ReviewedContact[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [emailSubjectDraft, setEmailSubjectDraft] = useState('');
  const [emailBodyDraft, setEmailBodyDraft] = useState('');
  const [emailDraftDirty, setEmailDraftDirty] = useState(false);
  const [googleOAuth, setGoogleOAuth] = useState<{
    connected: boolean;
    google_email?: string | null;
    oauth_configured?: boolean;
    encryption_configured?: boolean;
  } | null>(null);
  const [sheetDraft, setSheetDraft] = useState('');
  const sheetLinkRef = useRef<HTMLInputElement>(null);
  const [slackDraft, setSlackDraft] = useState('');
  const slackChannelRef = useRef<HTMLInputElement>(null);
  const spreadsheetDarkRef = useRef<HTMLDivElement>(null);
  const outreachDarkRef = useRef<HTMLDivElement>(null);
  const slackDeliveryRef = useRef<HTMLDivElement>(null);

  const integration = sprint?.integrations ?? {};
  const aggregateVerdict = sprint?.verdict?.verdict;
  const [contactsReady, setContactsReady] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined' && sheetLinkRef.current === document.activeElement) return;
    const url = integration.google_sheet_url?.trim();
    const sid = integration.google_sheet_id?.trim();
    setSheetDraft(url || sid || '');
  }, [integration.google_sheet_url, integration.google_sheet_id, sprint?.sprint_id]);

  useEffect(() => {
    setLastSpreadsheetPrep(null);
  }, [sprint?.sprint_id]);

  useEffect(() => {
    if (typeof document !== 'undefined' && slackChannelRef.current === document.activeElement) return;
    setSlackDraft(integration.slack_channel ?? '');
  }, [integration.slack_channel, sprint?.sprint_id]);

  useEffect(() => {
    if (!sprint?.sprint_id) {
      setContactsReady(false);
      setContactRows([]);
      return;
    }
    try {
      const raw = sessionStorage.getItem(contactsSessionKey(sprint.sprint_id));
      if (!raw) {
        setContactsReady(false);
        setContactRows([]);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      const contacts = Array.isArray(parsed) ? (parsed as SpreadsheetContactRow[]) : [];
      setContactRows(toReviewedContacts(contacts));
      setContactsReady(contacts.length > 0);
    } catch {
      setContactsReady(false);
      setContactRows([]);
    }
  }, [sprint?.sprint_id, sprint?.post_sprint?.spreadsheet?.validContacts, lastSpreadsheetPrep?.validContacts]);

  useEffect(() => {
    if (!sprint || emailDraftDirty) return;
    const copy = buildOutreachCopy(sprint);
    if (!copy) return;
    setEmailSubjectDraft(copy.subjectLine);
    setEmailBodyDraft(copy.baseBody);
  }, [emailDraftDirty, sprint]);

  useEffect(() => {
    setEmailDraftDirty(false);
  }, [sprint?.sprint_id]);

  useEffect(() => {
    if (!sprint?.sprint_id) {
      setGoogleOAuth(null);
      return;
    }
    const ac = new AbortController();
    void fetch(`/api/integrations/google/status?sprint_id=${encodeURIComponent(sprint.sprint_id)}`, {
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((data) =>
        setGoogleOAuth(
          data as {
            connected: boolean;
            google_email?: string | null;
            oauth_configured?: boolean;
            encryption_configured?: boolean;
          },
        ),
      )
      .catch((err: unknown) => {
        if ((err as Error)?.name === 'AbortError') return;
        setGoogleOAuth({
          connected: false,
          google_email: null,
          oauth_configured: false,
          encryption_configured: false,
        });
      });
    return () => ac.abort();
  }, [sprint?.sprint_id]);

  /** Scroll detail panels to top target after mount */
  useLayoutEffect(() => {
    const container = scrollParentRef?.current;
    if (variant === 'overview' || !container) return;
    const target =
      variant === 'sheet'
        ? spreadsheetDarkRef.current
        : variant === 'outreach'
          ? outreachDarkRef.current
          : variant === 'slack'
            ? slackDeliveryRef.current
            : null;
    if (!target) return;

    const scroll = () => scrollIntoScrollParent(container, target, 12);
    scroll();
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(scroll);
    });
    const t1 = window.setTimeout(scroll, 120);
    const t2 = window.setTimeout(scroll, 320);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [variant, scrollParentRef, sprint?.sprint_id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    const err = q.get('google_error');
    if (err) setError(decodeURIComponent(err.replace(/\+/g, ' ')));
  }, []);

  const canPrepareSpreadsheet =
    aggregateVerdict === 'GO' || aggregateVerdict === 'ITERATE';

  const spreadsheetBlockReason =
    !sprint
      ? 'Load a sprint before preparing contacts.'
      : !aggregateVerdict
        ? 'Run the sprint through VerdictAgent before preparing outreach contacts.'
        : aggregateVerdict === 'NO-GO'
          ? 'NO-GO blocks SpreadsheetAgent and OutreachAgent by design.'
          : !canPrepareSpreadsheet
            ? 'SpreadsheetAgent activates only when aggregate verdict is GO or ITERATE.'
            : liveGoogleSheet && googleOAuth === null
              ? 'Checking Google connection…'
              : liveGoogleSheet && googleOAuth?.connected !== true
                ? 'Connect Google before pulling the live sheet.'
                : null;

  const canRunPrepareSheet = spreadsheetBlockReason === null;

  const canSendOutreach =
    canPrepareSpreadsheet &&
    contactsReady &&
    contactRows.some((row) => row.selected && row.email.trim());

  const patchIntegrations = async (partial: Record<string, unknown>) => {
    if (!sprint?.sprint_id) return;
    setLoading('integrations');
    setError(null);
    try {
      const res = await fetch(`/api/sprint/${sprint.sprint_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrations: {
            gmail_connected: integration.gmail_connected ?? false,
            sheets_connected: integration.sheets_connected ?? false,
            slack_connected: integration.slack_connected ?? false,
            google_sheet_id: integration.google_sheet_id ?? null,
            google_sheet_url: integration.google_sheet_url ?? '',
            google_sheet_name: integration.google_sheet_name ?? null,
            slack_channel: integration.slack_channel ?? '',
            canvas_sheet: integration.canvas_sheet ?? false,
            canvas_outreach: integration.canvas_outreach ?? false,
            canvas_slack: integration.canvas_slack ?? false,
            ...partial,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Update failed');
      onSprintPatched?.((data as { sprint: unknown }).sprint ?? data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(null);
    }
  };

  const refreshSprintFromServer = async () => {
    if (!sprint?.sprint_id || !onSprintPatched) return;
    const res = await fetch(`/api/sprint/${encodeURIComponent(sprint.sprint_id)}`);
    if (!res.ok) return;
    const json = (await res.json()) as Record<string, unknown>;
    onSprintPatched(json);
  };

  const disconnectGoogle = async () => {
    if (!sprint?.sprint_id) return;
    setLoading('integrations');
    setError(null);
    try {
      const res = await fetch('/api/integrations/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprint_id: sprint.sprint_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Disconnect failed');
      onSprintPatched?.((data as { sprint: unknown }).sprint ?? data);
      setGoogleOAuth((prev) =>
        prev
          ? { ...prev, connected: false, google_email: null }
          : { connected: false, google_email: null },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(null);
    }
  };

  const prepareSheet = async () => {
    if (!sprint?.sprint_id) return;
    setLoading('prepare');
    setError(null);
    try {
      const rows = liveGoogleSheet ? [] : parseCsvToRows(csvText);
      const res = await fetch(`/api/sprint/${sprint.sprint_id}/post-sprint/prepare-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows,
          sheetName: integration.google_sheet_name ?? 'Contacts',
          icp_filter: icpFilter,
          live_google_sheet: liveGoogleSheet,
          google_sheet_input: sheetDraft.trim(),
        }),
      });
      const data = await readJsonOrError(res);
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Prepare failed');
      const spreadsheet = (data as { spreadsheet?: SpreadsheetAgentOutput }).spreadsheet;
      if (spreadsheet) setLastSpreadsheetPrep(spreadsheet);
      onSprintPatched?.((data as { sprint: unknown }).sprint);
      if (typeof window !== 'undefined' && spreadsheet?.contacts?.length) {
        const reviewed = toReviewedContacts(spreadsheet.contacts);
        setContactRows(reviewed);
        setPreviewIndex(0);
        setContactsReady(reviewed.length > 0);
        persistReviewedContacts(sprint.sprint_id, reviewed);
      }
      await refreshSprintFromServer();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(null);
    }
  };

  const sendOutreach = async () => {
    if (!sprint?.sprint_id) return;
    setLoading('outreach');
    setError(null);
    try {
      const contacts = selectedContacts(contactRows);
      const payload = {
        contacts,
        confirm_large_batch: contacts.length > 2000,
        subject_line: emailSubjectDraft,
        body_template: emailBodyDraft,
      };
      let res = await fetch(`/api/sprint/${sprint.sprint_id}/post-sprint/send-outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let data = await readJsonOrError(res);
      if (res.status === 409 && (data as { needsConfirm?: boolean }).needsConfirm && contacts.length > 2000) {
        res = await fetch(`/api/sprint/${sprint.sprint_id}/post-sprint/send-outreach`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, confirm_large_batch: true }),
        });
        data = await readJsonOrError(res);
      }
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Send failed');
      onSprintPatched?.((data as { sprint: unknown }).sprint);
      await refreshSprintFromServer();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(null);
    }
  };

  const postSlack = async () => {
    if (!sprint?.sprint_id) return;
    setLoading('slack');
    setError(null);
    try {
      const res = await fetch(`/api/sprint/${sprint.sprint_id}/post-sprint/post-slack`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Slack failed');
      onSprintPatched?.((data as { sprint: unknown }).sprint);
      await refreshSprintFromServer();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(null);
    }
  };

  const spreadsheetPrepDisplay =
    lastSpreadsheetPrep ?? sprint?.post_sprint?.spreadsheet ?? undefined;

  const activeContacts = selectedContacts(contactRows);
  const fallbackPreviewContact = contactRows.find((row) => row.email.trim()) ?? null;
  const previewContact =
    activeContacts[Math.min(previewIndex, Math.max(0, activeContacts.length - 1))] ??
    activeContacts[0] ??
    fallbackPreviewContact;
  const generatedOutreachCopy = sprint ? buildOutreachCopy(sprint) : null;
  const previewSubject = stripHtml(emailSubjectDraft || generatedOutreachCopy?.subjectLine || '');
  const previewBodyTemplate = stripHtml(emailBodyDraft || generatedOutreachCopy?.baseBody || '');
  const emailPreview =
    previewContact && previewSubject && previewBodyTemplate
      ? {
          subjectLine: previewSubject,
          body: personalizeTemplate(previewBodyTemplate, previewContact),
        }
      : null;
  const selectedContactCount = activeContacts.length;

  const updateContactRow = (index: number, patch: Partial<SpreadsheetContactRow & { selected: boolean }>) => {
    if (!sprint?.sprint_id) return;
    setContactRows((current) => {
      const next = current.map((row, i) => (i === index ? { ...row, ...patch } : row));
      persistReviewedContacts(sprint.sprint_id, next);
      setContactsReady(selectedContacts(next).length > 0);
      return next;
    });
  };

  const lostContactSession =
    !!sprint?.post_sprint?.spreadsheet?.validContacts &&
    sprint.post_sprint.spreadsheet.validContacts > 0 &&
    contactRows.length === 0;

  const persistSheetLinkFromDraft = () => {
    const v = sheetDraft.trim();
    if (/^https?:\/\//i.test(v)) void patchIntegrations({ google_sheet_url: v, google_sheet_id: null });
    else void patchIntegrations({ google_sheet_id: v || null, google_sheet_url: null });
  };

  const persistSlackChannelFromDraft = () => {
    void patchIntegrations({ slack_channel: slackDraft.trim() || null });
  };

  const inpOnDark: CSSProperties = {
    ...inpStyle(),
    background: '#FFFFFF',
    color: C.ink,
  };

  const oauthEl = (
    <div style={{ marginBottom: 14 }}>
      {googleOAuth === null && (
        <p style={{ fontSize: '0.75rem', color: 'rgba(250,250,248,0.65)' }}>Checking Google configuration…</p>
      )}
      {googleOAuth !== null && googleOAuth.oauth_configured && googleOAuth.encryption_configured ? (
        <>
          {googleOAuth.connected ? (
            <p style={{ fontSize: '0.8125rem', color: '#FAFAF8' }}>
              Connected{googleOAuth.google_email ? ` · ${googleOAuth.google_email}` : ''}.
            </p>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: 'rgba(250,250,248,0.75)' }}>
              Authorize Google — Sheets (read) + Gmail (send); refresh token encrypted on the server.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {!googleOAuth.connected ? (
              <button
                type="button"
                onClick={() => {
                  if (!sprint?.sprint_id) return;
                  window.location.href = `/api/integrations/google/start?sprint_id=${encodeURIComponent(sprint.sprint_id)}`;
                }}
                disabled={loading !== null || !sprint?.sprint_id}
                style={{
                  ...btnPrimary(),
                  background: '#FAFAF8',
                  color: C.ink,
                }}
              >
                Connect Google
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void disconnectGoogle()}
                disabled={loading !== null}
                style={{
                  height: 34,
                  padding: '0 14px',
                  background: 'transparent',
                  color: '#FAFAF8',
                  border: '1px solid rgba(250,250,248,0.35)',
                  borderRadius: 8,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: loading !== null ? 'default' : 'pointer',
                }}
              >
                Disconnect Google
              </button>
            )}
          </div>
        </>
      ) : googleOAuth !== null ? (
        <p style={{ fontSize: '0.75rem', color: '#FBBF24' }}>
          Add Google OAuth + GOOGLE_OAUTH_SECRET in server env for live APIs.
        </p>
      ) : null}
    </div>
  );

  return (
    <div>
      {variant === 'overview' && (
      <>
      <SectionTitle>Integrations</SectionTitle>

      <p style={{ fontSize: '0.8125rem', color: C.muted, marginBottom: 14, lineHeight: 1.45 }}>
        Enable agents here to show their canvas nodes. Click a node after implementation to open its own panel — not this overview.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))',
          gap: 14,
          marginBottom: 12,
        }}
      >
        <div style={{ ...cardStyle(), padding: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: C.faint,
              }}
            >
              <Table2 size={22} strokeWidth={1.75} color={C.muted} aria-hidden />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: C.ink, letterSpacing: '-0.02em' }}>
                SpreadsheetAgent
              </div>
              <p style={{ fontSize: '0.75rem', color: C.muted, margin: '6px 0 10px', lineHeight: 1.45 }}>
                Prepare your contact list from CSV or Google Sheets before outreach runs.
              </p>
              <label style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!integration.canvas_sheet}
                  onChange={(e) => void patchIntegrations({ canvas_sheet: e.target.checked })}
                />
                Implement
              </label>
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle(), padding: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: C.faint,
              }}
            >
              <Mail size={22} strokeWidth={1.75} color={C.muted} aria-hidden />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: C.ink, letterSpacing: '-0.02em' }}>
                OutreachAgent · Gmail
              </div>
              <label style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!integration.canvas_outreach}
                  onChange={(e) => void patchIntegrations({ canvas_outreach: e.target.checked })}
                />
                Implement
              </label>
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle(), padding: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: C.faint,
              }}
            >
              <SlackGlyph size={22} color={C.muted} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: C.ink, letterSpacing: '-0.02em' }}>
                SlackAgent
              </div>
              <p style={{ fontSize: '0.75rem', color: C.muted, margin: '6px 0 10px', lineHeight: 1.45 }}>
                Posts a sprint summary to a channel (server bot token). No recipient PII in Slack.
              </p>
              <label style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!integration.canvas_slack}
                  onChange={(e) => void patchIntegrations({ canvas_slack: e.target.checked })}
                />
                Implement
              </label>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {variant === 'sheet' && (
        <>
          <SectionTitle>SpreadsheetAgent</SectionTitle>
          
          <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(420px, 1fr)', gap: 14, alignItems: 'start' }}>
          <div
            style={{
              order: 2,
              borderRadius: 16,
              padding: 18,
              marginBottom: 12,
              background: '#151513',
              border: '1px solid rgba(250,250,248,0.14)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            }}
          >
            <div ref={spreadsheetDarkRef}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#FAFAF8', letterSpacing: '-0.02em', marginBottom: 8 }}>
                Contacts source
              </div>
              {oauthEl}
              {(sheetDraft.trim() || integration.google_sheet_url?.trim()) && !liveGoogleSheet ? (
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'rgba(250,250,248,0.72)',
                    lineHeight: 1.45,
                    marginBottom: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(250,250,248,0.06)',
                    border: '1px solid rgba(250,250,248,0.12)',
                  }}
                >
                  A spreadsheet URL is saved — turn on <strong style={{ fontWeight: 600 }}>Pull first tab live</strong> after connecting Google to
                  fetch it server-side. Until then, paste an exported CSV (same columns as your sheet) in the box below.
                </p>
              ) : null}
              <Label>
                <span style={{ color: 'rgba(250,250,248,0.75)' }}>Spreadsheet URL or ID</span>
              </Label>
              <input
                ref={sheetLinkRef}
                value={sheetDraft}
                onChange={(e) => setSheetDraft(e.target.value)}
                onBlur={() => persistSheetLinkFromDraft()}
                placeholder="https://docs.google.com/spreadsheets/d/… or spreadsheet ID"
                style={{ ...inpOnDark, marginBottom: 12, marginTop: 6 }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', marginBottom: 10, color: 'rgba(250,250,248,0.9)' }}>
                <input
                  type="checkbox"
                  checked={liveGoogleSheet}
                  onChange={(e) => setLiveGoogleSheet(e.target.checked)}
                />
                Pull first tab live (requires Connect Google)
              </label>
              {!liveGoogleSheet && (
                <>
                  <Label>
                    <span style={{ color: 'rgba(250,250,248,0.75)' }}>Paste CSV (comma-separated)</span>
                  </Label>
                  <p style={{ fontSize: '0.75rem', color: 'rgba(250,250,248,0.68)', lineHeight: 1.45, marginBottom: 8 }}>
                    First line = headers. Include one column whose name contains “email”. Other columns can be first name, company, role — we match
                    common header names from Sheets exports.
                  </p>
                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    rows={6}
                    style={{
                      ...taStyle(),
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      background: '#FFFFFF',
                      color: C.ink,
                      marginBottom: 10,
                    }}
                  />
                </>
              )}
              {liveGoogleSheet && (
                <p style={{ fontSize: '0.75rem', color: 'rgba(250,250,248,0.7)', marginBottom: 10 }}>
                  Uses the spreadsheet URL or ID above as the workbook to read (first worksheet tab).
                </p>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', marginBottom: 10, color: 'rgba(250,250,248,0.9)' }}>
                <input type="checkbox" checked={icpFilter} onChange={(e) => setIcpFilter(e.target.checked)} />
                Optional ICP keyword filter (Genome)
              </label>
              <button
                type="button"
                onClick={() => void prepareSheet()}
                disabled={loading !== null || !canRunPrepareSheet}
                title={spreadsheetBlockReason ?? undefined}
                style={{
                  ...btnPrimary(),
                  background: '#FAFAF8',
                  color: C.ink,
                  opacity: loading !== null || !canRunPrepareSheet ? 0.5 : 1,
                  cursor: loading !== null || !canRunPrepareSheet ? 'not-allowed' : 'pointer',
                }}
              >
                {loading === 'prepare' ? 'Preparing…' : 'Run SpreadsheetAgent'}
              </button>
              {spreadsheetBlockReason && (
                <p style={{ fontSize: '0.75rem', color: 'rgba(250,250,248,0.65)', marginTop: 8 }}>
                  {spreadsheetBlockReason}
                </p>
              )}
              <SpreadsheetPrepSummaryCard output={spreadsheetPrepDisplay} />
              {contactRows.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 10,
                    background: 'rgba(250,250,248,0.08)',
                    border: '1px solid rgba(250,250,248,0.14)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.75rem', color: '#FAFAF8', letterSpacing: '0.02em' }}>
                        Review contact list
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!sprint?.sprint_id) return;
                        const next = contactRows.map((row) => ({ ...row, selected: true }));
                        setContactRows(next);
                        setContactsReady(next.length > 0);
                        persistReviewedContacts(sprint.sprint_id, next);
                      }}
                      style={{ height: 28, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(250,250,248,0.26)', background: 'transparent', color: '#FAFAF8', fontSize: '0.72rem', cursor: 'pointer' }}
                    >
                      Restore all
                    </button>
                  </div>

                  <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 2 }}>
                    {contactRows.map((contact, index) => (
                      <div
                        key={`contact-${index}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '18px minmax(145px,1fr) minmax(82px,.7fr)',
                          gap: 7,
                          alignItems: 'center',
                          padding: 8,
                          borderRadius: 8,
                          background: contact.selected ? 'rgba(250,250,248,0.08)' : 'rgba(250,250,248,0.03)',
                          border: `1px solid ${contact.selected ? 'rgba(250,250,248,0.14)' : 'rgba(250,250,248,0.08)'}`,
                          opacity: contact.selected ? 1 : 0.58,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={contact.selected}
                          onChange={(e) => updateContactRow(index, { selected: e.target.checked })}
                          aria-label={`Select ${contact.email}`}
                        />
                        <div style={{ display: 'grid', gap: 5 }}>
                          <input
                            value={contact.email}
                            onChange={(e) => updateContactRow(index, { email: e.target.value })}
                            style={{ ...inpOnDark, margin: 0, height: 30, fontSize: '0.75rem' }}
                            placeholder="email@company.com"
                          />
                          <input
                            value={contact.company ?? ''}
                            onChange={(e) => updateContactRow(index, { company: e.target.value || null })}
                            style={{ ...inpOnDark, margin: 0, height: 30, fontSize: '0.75rem' }}
                            placeholder="Company"
                          />
                        </div>
                        <div style={{ display: 'grid', gap: 5 }}>
                          <input
                            value={contact.firstName ?? ''}
                            onChange={(e) => updateContactRow(index, { firstName: e.target.value || null })}
                            style={{ ...inpOnDark, margin: 0, height: 30, fontSize: '0.75rem' }}
                            placeholder="First name"
                          />
                          <input
                            value={contact.role ?? ''}
                            onChange={(e) => updateContactRow(index, { role: e.target.value || null })}
                            style={{ ...inpOnDark, margin: 0, height: 30, fontSize: '0.75rem' }}
                            placeholder="Role"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              )}
              <IntegrationAgentLog events={sprint?.events} variant="sheet" />
            </div>
          </div>
          <aside
            style={{
              order: 1,
              position: 'sticky',
              top: 0,
              borderRadius: 16,
              padding: 0,
              background: '#F8F6F1',
              border: `1px solid ${C.border}`,
              color: C.ink,
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(17,17,16,0.08)',
            }}
          >
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, background: C.surface }}>
              <div style={{ fontWeight: 900, fontSize: '0.8125rem', letterSpacing: '-0.02em' }}>Live email preview</div>
              <p style={{ margin: '3px 0 0', fontSize: '0.7rem', color: C.muted, lineHeight: 1.35 }}>
                Real-time preview from selected contacts.
              </p>
            </div>
            {emailPreview ? (
              <div style={{ padding: 14 }}>
                <div style={{ borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, background: C.faint }}>
                    <p style={{ margin: 0, fontSize: '0.6875rem', color: C.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Gmail draft
                    </p>
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: C.ink, color: '#FFF', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '0.875rem', flexShrink: 0 }}>
                        {(previewContact?.firstName || previewContact?.email || 'C')[0]?.toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: C.ink }}>
                          {previewContact?.firstName || 'there'}{previewContact?.company ? ` · ${previewContact.company}` : ''}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.6875rem', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          To: {previewContact?.email}
                        </p>
                      </div>
                    </div>
                    <div style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: '9px 0', marginBottom: 10 }}>
                      <p style={{ margin: 0, fontSize: '0.6875rem', color: C.muted }}>Subject</p>
                      <input
                        value={emailSubjectDraft || generatedOutreachCopy?.subjectLine || ''}
                        onChange={(e) => {
                          setEmailDraftDirty(true);
                          setEmailSubjectDraft(stripHtml(e.target.value));
                        }}
                        style={{ ...inpStyle(), marginTop: 5, fontSize: '0.8125rem', fontWeight: 800, background: '#FFF' }}
                      />
                    </div>
                    <textarea
                      value={emailBodyDraft || generatedOutreachCopy?.baseBody || ''}
                      onChange={(e) => {
                        setEmailDraftDirty(true);
                        setEmailBodyDraft(stripHtml(e.target.value));
                      }}
                      rows={10}
                      style={{
                        ...taStyle(),
                        minHeight: 190,
                        resize: 'vertical',
                        background: '#FFF',
                        color: C.ink,
                        fontFamily: 'inherit',
                        fontSize: '0.8125rem',
                        lineHeight: 1.6,
                      }}
                    />
                    <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: C.faint, border: `1px solid ${C.border}` }}>
                      <p style={{ margin: '0 0 6px', fontSize: '0.6875rem', color: C.muted, fontWeight: 800 }}>
                        Personalized preview
                      </p>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.75rem', lineHeight: 1.5, color: C.ink }}>
                        {emailPreview.body}
                      </pre>
                    </div>
                  </div>
                </div>
                {activeContacts.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    {activeContacts.slice(0, 8).map((contact, index) => (
                      <button
                        key={`${contact.email}-${index}`}
                        type="button"
                        onClick={() => setPreviewIndex(index)}
                        style={{
                          height: 26,
                          padding: '0 8px',
                          borderRadius: 999,
                          border: `1px solid ${previewContact?.email === contact.email ? C.ink : C.border}`,
                          background: previewContact?.email === contact.email ? C.ink : C.surface,
                          color: previewContact?.email === contact.email ? '#FFF' : C.muted,
                          fontSize: '0.6875rem',
                          cursor: 'pointer',
                        }}
                      >
                        {contact.firstName || contact.email.split('@')[0]}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void sendOutreach()}
                  disabled={loading !== null || !canSendOutreach}
                  style={{
                    ...btnPrimary(),
                    width: '100%',
                    height: 38,
                    marginTop: 12,
                    background: C.ink,
                    color: '#FFF',
                    opacity: loading !== null || !canSendOutreach ? 0.5 : 1,
                    cursor: loading !== null || !canSendOutreach ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading === 'outreach' ? 'Sending…' : `Send ${selectedContactCount} Email${selectedContactCount === 1 ? '' : 's'}`}
                </button>
                <p style={{ margin: '8px 0 0', fontSize: '0.6875rem', color: C.muted, lineHeight: 1.4 }}>
                  Rate limited server-side through Gmail. Sends plain text for deliverability.
                </p>
              </div>
            ) : (
              <div style={{ margin: 14, padding: 12, borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontSize: '0.75rem', lineHeight: 1.45 }}>
                Prepare a sheet and keep at least one contact selected to see the personalized Gmail preview here.
              </div>
            )}
          </aside>
          </div>
        </>
      )}

      {variant === 'outreach' && (
        <>
          <SectionTitle>OutreachAgent · Gmail</SectionTitle>
          <p style={{ fontSize: '0.8125rem', color: C.muted, marginBottom: 14, lineHeight: 1.45 }}>
            Batch plain-text sends using prepared contacts (session storage until send).
          </p>
          <div
            style={{
              borderRadius: 16,
              padding: 18,
              marginBottom: 12,
              background: C.ink,
              border: `1px solid ${C.border}`,
            }}
          >
            <div ref={outreachDarkRef}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#FAFAF8', letterSpacing: '-0.02em', marginBottom: 8 }}>
                Gmail batch send
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'rgba(250,250,248,0.86)', lineHeight: 1.45, marginBottom: 14 }}>
                Uses your Google connection for plain-text sends (winning angle subject + body).
              </p>
              {oauthEl}
              {emailPreview && (
                <div style={{ padding: 12, borderRadius: 10, background: 'rgba(250,250,248,0.08)', border: '1px solid rgba(250,250,248,0.14)', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.75rem', color: '#FAFAF8', marginBottom: 6 }}>
                    Preview · {selectedContactCount} selected
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: '0.75rem', color: 'rgba(250,250,248,0.62)' }}>
                    To example: {previewContact?.email}
                  </p>
                  <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', color: '#FAFAF8', fontWeight: 700 }}>
                    Subject: {emailPreview.subjectLine}
                  </p>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.75rem', lineHeight: 1.5, color: 'rgba(250,250,248,0.86)' }}>
                    {emailPreview.body}
                  </pre>
                </div>
              )}
              <div style={{ height: 1, background: 'rgba(250,250,248,0.12)', margin: '18px 0' }} />
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#FAFAF8', marginBottom: 6 }}>Confirm outreach</div>
              <p style={{ fontSize: '0.75rem', color: 'rgba(250,250,248,0.75)', marginBottom: 10, lineHeight: 1.45 }}>
                Sends through your connected Google account (rate-limited server-side).
              </p>
              <button
                type="button"
                onClick={() => void sendOutreach()}
                disabled={loading !== null || !canSendOutreach}
                style={{
                  ...btnPrimary(),
                  background: '#FAFAF8',
                  color: C.ink,
                }}
              >
                {loading === 'outreach' ? 'Sending…' : 'Confirm & run OutreachAgent'}
              </button>
              {lostContactSession && (
                <p style={{ fontSize: '0.75rem', color: '#FBBF24', marginTop: 8 }}>
                  Contacts live in this browser session — run SpreadsheetAgent again to reload.
                </p>
              )}
              {!contactsReady && canPrepareSpreadsheet && (
                <p style={{ fontSize: '0.75rem', color: 'rgba(250,250,248,0.65)', marginTop: 8 }}>
                  Prepare contacts first (Spreadsheet node).
                </p>
              )}
              <IntegrationAgentLog events={sprint?.events} variant="outreach" />
            </div>
          </div>
        </>
      )}

      {variant === 'slack' && (
        <>
          <SectionTitle>SlackAgent</SectionTitle>
          <p style={{ fontSize: '0.8125rem', color: C.muted, marginBottom: 14, lineHeight: 1.45 }}>
            Post an aggregate sprint summary to your workspace channel (no recipient PII).
          </p>
          <div ref={slackDeliveryRef} style={{ ...cardStyle() }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: C.faint,
                }}
              >
                <SlackGlyph size={22} color={C.muted} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: C.ink }}>Slack delivery</div>
                <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 4, lineHeight: 1.45 }}>
                  Bot posts an aggregate sprint summary to the channel you choose. Requires{' '}
                  <code style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>SLACK_BOT_TOKEN</code> on the server and scopes to chat:write.
                </p>
              </div>
            </div>
            <Label>Channel</Label>
            <input
              ref={slackChannelRef}
              value={slackDraft}
              onChange={(e) => setSlackDraft(e.target.value)}
              onBlur={() => persistSlackChannelFromDraft()}
              placeholder="#general"
              style={{ ...inpStyle(), marginBottom: 10 }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={!!integration.slack_connected}
                onChange={(e) => void patchIntegrations({ slack_connected: e.target.checked })}
              />
              Mark Slack path ready (demo / server configured)
            </label>
            <button
              type="button"
              onClick={() => void postSlack()}
              disabled={loading !== null || sprint?.state !== 'COMPLETE'}
              style={btnPrimary()}
            >
              {loading === 'slack' ? 'Posting…' : 'Run SlackAgent'}
            </button>
          </div>
        </>
      )}

      {error && <p style={{ fontSize: '0.8125rem', color: C.stop }}>{error}</p>}
    </div>
  );
}

function cardStyle(): CSSProperties {
  return {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 14,
  };
}

function inpStyle(): CSSProperties {
  return {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    fontSize: '0.875rem',
    boxSizing: 'border-box',
  };
}

function taStyle(): CSSProperties {
  return {
    ...inpStyle(),
    resize: 'vertical' as const,
    minHeight: 100,
  };
}

function btnPrimary(): CSSProperties {
  return {
    marginTop: 8,
    height: 34,
    padding: '0 14px',
    background: C.ink,
    color: '#FFF',
    border: 'none',
    borderRadius: 8,
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
  };
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
  const panelBodyRef = useRef<HTMLDivElement>(null);
  if (!panel) return null;
  const isIntegrationSurface =
    panel === 'integrations' ||
    panel === 'integrations_sheet' ||
    panel === 'integrations_outreach' ||
    panel === 'integrations_slack';
  const panelWidth =
    panel === 'landing'
      ? 820
      : panel === 'integrations_sheet'
        ? 760
      : isIntegrationSurface
        ? 440
        : 380;

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
      case 'integrations':
        return (
          <IntegrationsPanel
            sprint={sprint}
            variant="overview"
            scrollParentRef={panelBodyRef}
            onSprintPatched={onSprintPatched}
          />
        );
      case 'integrations_sheet':
        return (
          <IntegrationsPanel
            sprint={sprint}
            variant="sheet"
            scrollParentRef={panelBodyRef}
            onSprintPatched={onSprintPatched}
          />
        );
      case 'integrations_outreach':
        return (
          <IntegrationsPanel
            sprint={sprint}
            variant="outreach"
            scrollParentRef={panelBodyRef}
            onSprintPatched={onSprintPatched}
          />
        );
      case 'integrations_slack':
        return (
          <IntegrationsPanel
            sprint={sprint}
            variant="slack"
            scrollParentRef={panelBodyRef}
            onSprintPatched={onSprintPatched}
          />
        );
      case 'benchmarks': return <BenchmarksPanel />;
      case 'settings':   return <SettingsPanel />;
      default: return null;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key={panel + (channel ?? '')}
        className="nodrag nopan"
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
          {sprint && sprint.state !== 'COMPLETE' && onRunWorkflow && !isIntegrationSurface && (
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
        <div ref={panelBodyRef} style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>
          {content()}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
