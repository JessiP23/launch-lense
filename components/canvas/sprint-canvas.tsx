'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow, useNodesState, useEdgesState, Background, BackgroundVariant,
  Controls, type Node, type Edge, type NodeTypes, type EdgeTypes, type NodeMouseHandler,
  ReactFlowProvider, Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { CanvasToolbar } from './canvas-toolbar';
import { NodePanel, type PanelId } from './node-panel';
import { PipelineEdge, type EdgeState } from './pipeline-edge';
import {
  AccountsNode, GenomeNode, HealthgateNode, AnglesNode,
  LandingNode, CampaignNode, VerdictNode, ReportNode, BenchmarksNode, SettingsNode,
} from './canvas-nodes';
import { useAppStore } from '@/lib/store';
import type { Platform, SprintRecord, SprintState } from '@/lib/agents/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

// ── Node & Edge type registries ──────────────────────────────────────────────
const nodeTypes: NodeTypes = {
  accounts:   AccountsNode,
  genome:     GenomeNode,
  healthgate: HealthgateNode,
  angles:     AnglesNode,
  landing:    LandingNode,
  campaign:   CampaignNode,
  verdict:    VerdictNode,
  report:     ReportNode,
  benchmarks: BenchmarksNode,
  settings:   SettingsNode,
};

const edgeTypes: EdgeTypes = { pipeline: PipelineEdge };

// ── Layout constants ─────────────────────────────────────────────────────────
const X = { accounts: 80, genome: 290, hg: 500, angles: 710, landing: 920, campaign: 1130, verdict: 1340, report: 1550 };
const Y_CENTER = 255;
const Y_STACK  = [90, 200, 310, 420]; // HG + Campaign rows per channel
const CHANNELS = ['meta', 'google', 'linkedin', 'tiktok'] as const;

// ── Sprint state → node/edge stage mapping ───────────────────────────────────
type NodeStage = 'idle' | 'running' | 'done' | 'blocked' | 'warn';

function sprintStageFor(nodeId: string, sprintState?: SprintState): NodeStage {
  if (!sprintState || sprintState === 'IDLE') return 'idle';
  const s = sprintState;

  if (nodeId === 'accounts') return 'done';
  if (nodeId === 'genome') {
    if (s === 'GENOME_RUNNING') return 'running';
    if (['GENOME_DONE','HEALTHGATE_RUNNING','HEALTHGATE_DONE','ANGLES_RUNNING','ANGLES_DONE','LANDING_RUNNING','LANDING_DONE','CAMPAIGN_RUNNING','CAMPAIGN_MONITORING','VERDICT_GENERATING','COMPLETE'].includes(s)) return 'done';
    if (s === 'BLOCKED') return 'blocked';
    return 'done'; // any non-IDLE state means accounts are done
  }
  if (nodeId.startsWith('hg-')) {
    if (s === 'GENOME_DONE' || s === 'HEALTHGATE_RUNNING') return 'running';
    if (['HEALTHGATE_DONE','ANGLES_RUNNING','ANGLES_DONE','LANDING_RUNNING','LANDING_DONE','CAMPAIGN_RUNNING','CAMPAIGN_MONITORING','VERDICT_GENERATING','COMPLETE'].includes(s)) return 'done';
    return 'idle';
  }
  if (nodeId === 'angles') {
    if (s === 'ANGLES_RUNNING') return 'running';
    if (['ANGLES_DONE','LANDING_RUNNING','LANDING_DONE','CAMPAIGN_RUNNING','CAMPAIGN_MONITORING','VERDICT_GENERATING','COMPLETE'].includes(s)) return 'done';
    return 'idle';
  }
  if (nodeId === 'landing') {
    if (s === 'LANDING_RUNNING') return 'running';
    if (['LANDING_DONE','CAMPAIGN_RUNNING','CAMPAIGN_MONITORING','VERDICT_GENERATING','COMPLETE'].includes(s)) return 'done';
    if (s === 'ANGLES_DONE') return 'warn';
    return 'idle';
  }
  if (nodeId.startsWith('campaign-')) {
    if (s === 'CAMPAIGN_RUNNING') return 'running';
    if (s === 'CAMPAIGN_MONITORING') return 'running';
    if (['VERDICT_GENERATING','COMPLETE'].includes(s)) return 'done';
    return 'idle';
  }
  if (nodeId === 'verdict') {
    if (s === 'VERDICT_GENERATING') return 'running';
    if (s === 'COMPLETE') return 'done';
    return 'idle';
  }
  if (nodeId === 'report') {
    if (s === 'COMPLETE') return 'done';
    return 'idle';
  }
  return 'idle';
}

function edgeStageFor(edgeId: string, sprintState?: SprintState): EdgeState {
  if (!sprintState || sprintState === 'IDLE') return 'pending';
  const s = sprintState;

  const CAMPAIGN_STATES = ['CAMPAIGN_RUNNING','CAMPAIGN_MONITORING','VERDICT_GENERATING','COMPLETE'] as SprintState[];
  const POST_HG = ['HEALTHGATE_DONE','ANGLES_RUNNING','ANGLES_DONE','LANDING_RUNNING','LANDING_DONE',...CAMPAIGN_STATES] as SprintState[];

  if (edgeId === 'e-accounts-genome') {
    if (s === 'GENOME_RUNNING') return 'running';
    return 'done'; // any non-IDLE state = done
  }
  if (edgeId.startsWith('e-genome-hg-')) {
    if (s === 'GENOME_DONE' || s === 'HEALTHGATE_RUNNING') return 'running';
    if (POST_HG.includes(s)) return 'done';
  }
  if (edgeId.startsWith('e-hg-') && edgeId.endsWith('-angles')) {
    if (s === 'ANGLES_RUNNING') return 'running';
    if (['ANGLES_DONE','LANDING_RUNNING','LANDING_DONE',...CAMPAIGN_STATES].includes(s)) return 'done';
  }
  if (edgeId === 'e-angles-landing') {
    if (s === 'LANDING_RUNNING') return 'running';
    if (['LANDING_DONE',...CAMPAIGN_STATES].includes(s)) return 'done';
    if (s === 'ANGLES_DONE') return 'warn';
  }
  if (edgeId.startsWith('e-landing-campaign-')) {
    if (CAMPAIGN_STATES.includes(s)) return 'running';
    return 'pending';
  }
  if (edgeId.startsWith('e-campaign-') && edgeId.endsWith('-verdict')) {
    if (s === 'VERDICT_GENERATING') return 'running';
    if (s === 'COMPLETE') return 'done';
  }
  if (edgeId === 'e-verdict-report') {
    if (s === 'COMPLETE') return 'done';
  }

  return 'pending';
}

// ── Build static node list ───────────────────────────────────────────────────
function buildNodes(sprint: SprintRecord | null): Node[] {
  const s  = sprint?.state;
  const g  = sprint?.genome;
  const hg = sprint?.healthgate;
  const a  = sprint?.angles;
  const l  = sprint?.landing;
  const c  = sprint?.campaign;
  const v  = sprint?.verdict;

  return [
    // Accounts
    { id: 'accounts', type: 'accounts', position: { x: X.accounts, y: Y_CENTER },
      data: { connectedCount: 0, stage: sprintStageFor('accounts', s) } },

    // Genome
    { id: 'genome', type: 'genome', position: { x: X.genome, y: Y_CENTER },
      data: { composite: g?.composite, signal: g?.signal, stage: sprintStageFor('genome', s) } },

    // Healthgate × 4
    ...CHANNELS.map((ch, i) => ({
      id: `hg-${ch}`, type: 'healthgate', position: { x: X.hg, y: Y_STACK[i] },
      data: { channel: ch, score: hg?.[ch]?.score, status: hg?.[ch]?.status, stage: sprintStageFor(`hg-${ch}`, s) },
    })),

    // Angles
    { id: 'angles', type: 'angles', position: { x: X.angles, y: Y_CENTER },
      data: { angleCount: a?.angles?.length, archetypes: a?.angles?.map((ang) => ang.archetype), stage: sprintStageFor('angles', s) } },

    // Landing pages
    { id: 'landing', type: 'landing', position: { x: X.landing, y: Y_CENTER },
      data: { pageCount: l?.pages?.length, stage: sprintStageFor('landing', s) } },

    // Campaign × 4
    ...CHANNELS.map((ch, i) => ({
      id: `campaign-${ch}`, type: 'campaign', position: { x: X.campaign, y: Y_STACK[i] },
      data: {
        channel: ch,
        ctr: c?.[ch]?.angle_metrics?.length
          ? c[ch].angle_metrics.reduce((s, a) => s + a.clicks, 0) /
            Math.max(1, c[ch].angle_metrics.reduce((s, a) => s + a.impressions, 0))
          : undefined,
        spendCents: c?.[ch]?.spent_cents,
        stage: sprintStageFor(`campaign-${ch}`, s),
      },
    })),

    // Verdict
    { id: 'verdict', type: 'verdict', position: { x: X.verdict, y: Y_CENTER },
      data: { verdict: v?.verdict, confidence: v?.confidence, stage: sprintStageFor('verdict', s) } },

    // Report
    { id: 'report', type: 'report', position: { x: X.report, y: Y_CENTER },
      data: { ready: !!sprint?.report?.pdf_url, stage: sprintStageFor('report', s) } },

    // Utility nodes
    { id: 'benchmarks', type: 'benchmarks', position: { x: X.accounts, y: 580 }, data: { stage: 'idle' as NodeStage } },
    { id: 'settings',   type: 'settings',   position: { x: X.genome,   y: 580 }, data: { stage: 'idle' as NodeStage, configured: false } },
  ];
}

function buildEdges(sprint: SprintRecord | null): Edge[] {
  const s = sprint?.state;

  const edges: Edge[] = [
    { id: 'e-accounts-genome', type: 'pipeline', source: 'accounts', target: 'genome', data: { state: edgeStageFor('e-accounts-genome', s) } },
    ...CHANNELS.map((ch) => ({
      id: `e-genome-hg-${ch}`, type: 'pipeline', source: 'genome', target: `hg-${ch}`,
      data: { state: edgeStageFor(`e-genome-hg-${ch}`, s) },
    })),
    ...CHANNELS.map((ch) => ({
      id: `e-hg-${ch}-angles`, type: 'pipeline', source: `hg-${ch}`, target: 'angles',
      data: { state: edgeStageFor(`e-hg-${ch}-angles`, s) },
    })),
    { id: 'e-angles-landing', type: 'pipeline', source: 'angles', target: 'landing', data: { state: edgeStageFor('e-angles-landing', s) } },
    ...CHANNELS.map((ch) => ({
      id: `e-landing-campaign-${ch}`, type: 'pipeline', source: 'landing', target: `campaign-${ch}`,
      data: { state: edgeStageFor(`e-landing-campaign-${ch}`, s) },
    })),
    ...CHANNELS.map((ch) => ({
      id: `e-campaign-${ch}-verdict`, type: 'pipeline', source: `campaign-${ch}`, target: 'verdict',
      data: { state: edgeStageFor(`e-campaign-${ch}-verdict`, s) },
    })),
    { id: 'e-verdict-report', type: 'pipeline', source: 'verdict', target: 'report', data: { state: edgeStageFor('e-verdict-report', s) } },
  ];
  return edges;
}

type RawSprintRecord = Partial<SprintRecord> & {
  id?: string;
  name?: string;
  status?: string;
};

function normalizeSprint(raw: RawSprintRecord | null): SprintRecord | null {
  if (!raw) return null;
  const sprintId = raw.sprint_id ?? raw.id;
  if (!sprintId) return null;

  return {
    ...raw,
    sprint_id: sprintId,
    idea: raw.idea ?? raw.name ?? 'Untitled sprint',
    org_id: raw.org_id ?? null,
    state: raw.state ?? (raw.status === 'completed' ? 'COMPLETE' : 'IDLE'),
    active_channels: raw.active_channels ?? [...CHANNELS],
    budget_cents: raw.budget_cents ?? 50000,
    created_at: raw.created_at ?? new Date().toISOString(),
    updated_at: raw.updated_at ?? raw.created_at ?? new Date().toISOString(),
  } as SprintRecord;
}

const DEMO_HEALTHGATE_DATA: Record<Platform, Record<string, unknown>> = {
  meta: {
    account_status: 'ACTIVE',
    balance: 50000,
    disapproved_90d: 0,
    funding_source: true,
    policy_violations: 0,
    pixel_active: true,
    two_factor_enabled: true,
    domain_verified: 'VERIFIED',
    page_quality: 0.82,
  },
  google: {
    account_status: 'ENABLED',
    past_due_invoices: false,
    policy_violations: 0,
    payment_method: true,
    conversion_tracking_active: true,
    search_network: true,
    account_age_days: 45,
    landing_page_policy: true,
    quality_score: 5,
  },
  linkedin: {
    account_status: 'ACTIVE',
    failed_payments: false,
    restricted_ads_90d: 0,
    payment_method: true,
    insight_tag_active: true,
    company_page_verified: true,
    review_status: 'CLEAR',
    sponsored_content_access: true,
    projected_audience: 1200,
  },
  tiktok: {
    account_status: 'APPROVED',
    failed_charges: false,
    rejected_creatives_90d: 0,
    pixel_active: true,
    identity_verified: true,
    business_center_access: true,
    region_eligible: true,
    content_category_status: 'APPROVED',
    flag_count: 0,
  },
};

// ── New Sprint Modal ─────────────────────────────────────────────────────────
function NewSprintModal({ onClose, onCreated }: { onClose: () => void; onCreated: (sprint: SprintRecord) => void }) {
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!idea.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/sprint', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: idea.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create sprint'); return; }
      const sprint = normalizeSprint(data.sprint ?? data);
      if (!sprint) { setError('Sprint was created but no sprint id was returned'); return; }
      onCreated(sprint);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally { setLoading(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,16,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        style={{ background: '#FAFAF8', borderRadius: 16, padding: 28, width: 520, boxShadow: '0 1px 2px rgba(0,0,0,0.06)', border: '1px solid #E8E4DC' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8C8880', marginBottom: 6 }}>New Sprint</p>
        <h2 style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em', color: '#111110', margin: '0 0 4px' }}>Describe your idea</h2>
        <p style={{ fontSize: '0.875rem', color: '#8C8880', margin: '0 0 16px' }}>1 sentence to 3 paragraphs. GenomeAgent will pre-screen before any ad spend.</p>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="e.g. A SaaS tool that automates invoice reconciliation for small accounting firms, saving 4 hours/week…"
          rows={5}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            border: '1px solid #E8E4DC', background: '#FFFFFF',
            fontSize: '0.9375rem', color: '#111110', resize: 'none',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
          autoFocus
        />
        {error && <p style={{ fontSize: '0.8125rem', color: '#DC2626', margin: '8px 0 0' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, height: 38, border: '1px solid #E8E4DC', borderRadius: 10, background: 'transparent', color: '#8C8880', fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit} disabled={loading || !idea.trim()}
            style={{ flex: 2, height: 38, background: '#111110', border: 'none', borderRadius: 10, color: '#FFF', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: idea.trim() ? 1 : 0.5 }}
          >
            {loading && <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />}
            {loading ? 'Creating sprint…' : 'Start Canvas Sprint'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Sprint state label ───────────────────────────────────────────────────────
function StateLabel({ state }: { state?: SprintState }) {
  if (!state || state === 'IDLE') return null;
  const running = ['GENOME_RUNNING','HEALTHGATE_RUNNING','ANGLES_RUNNING','LANDING_RUNNING','CAMPAIGN_RUNNING','CAMPAIGN_MONITORING','VERDICT_GENERATING'].includes(state);
  const label: Record<string, string> = {
    GENOME_RUNNING: 'GenomeAgent running…', GENOME_DONE: 'Genome complete',
    HEALTHGATE_RUNNING: 'HealthgateAgent × 4 running…', HEALTHGATE_DONE: 'Healthgate complete',
    ANGLES_RUNNING: 'AngleAgent running…', ANGLES_DONE: 'Angles generated',
    LANDING_RUNNING: 'Landing pages generating…', LANDING_DONE: 'Landing pages ready',
    CAMPAIGN_RUNNING: 'Campaigns launching…', CAMPAIGN_MONITORING: 'Monitoring campaigns…',
    VERDICT_GENERATING: 'VerdictAgent running…', COMPLETE: 'Sprint complete',
    BLOCKED: 'Sprint blocked',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#FFF', border: '1px solid #E8E4DC', borderRadius: 99, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
      {running && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#111110' }} className="animate-pulse" />}
      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#111110' }}>{label[state] ?? state}</span>
    </div>
  );
}

// ── Main canvas inner component (uses React Flow hooks) ─────────────────────
interface CanvasProps {
  initialPanel?: string;
  initialSprint?: string;
  openNew?: boolean;
}

function CanvasInner({ initialPanel, initialSprint, openNew }: CanvasProps) {
  const { connectedPlatforms } = useAppStore();

  const [sprints, setSprints] = useState<{ id: string; name: string; status: string }[]>([]);
  const [activeSprint, setActiveSprint] = useState<string | null>(initialSprint ?? null);
  const [sprintData, setSprintData] = useState<SprintRecord | null>(null);
  const [showNew, setShowNew] = useState(openNew ?? false);
  const [activePanel, setActivePanel] = useState<PanelId>((initialPanel as PanelId) ?? null);
  const [panelChannel, setPanelChannel] = useState<string | undefined>(undefined);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // ── Load sprint list ─────────────────────────────────────────────────────
  useEffect(() => {
    async function loadSprints() {
      try {
        const res = await fetch('/api/sprint');
        if (res.ok) {
          const data = await res.json();
          const rows = (data.sprints ?? []) as RawSprintRecord[];
          const mapped = rows
            .map(normalizeSprint)
            .filter((s): s is SprintRecord => Boolean(s))
            .map((s) => ({
              id: s.sprint_id,
              name: s.idea || s.sprint_id.slice(0, 8),
              status: s.state.toLowerCase().replace(/_/g, ' '),
            }));
          setSprints(mapped);
          if (mapped.length > 0 && !activeSprint) setActiveSprint(mapped[0].id);
        }
      } catch {}
    }
    loadSprints();
  }, [activeSprint]);

  // ── Load sprint detail ───────────────────────────────────────────────────
  const loadSprintDetail = useCallback(async (id: string) => {
    try {
      let data: SprintRecord | null = null;
      const res = await fetch(`/api/sprint/${id}`);
      if (res.ok) {
        const json = await res.json();
        data = normalizeSprint(json.sprint ?? json);
      } else {
        const res2 = await fetch(`/api/tests/${id}/metrics`);
        if (res2.ok) {
          const json2 = await res2.json();
          // Map legacy test format to sprint format
          data = normalizeSprint({
            sprint_id: id,
            idea: json2.test?.name ?? '',
            org_id: null,
            state: (json2.test?.status === 'active' ? 'CAMPAIGN_MONITORING' : json2.test?.status === 'completed' ? 'COMPLETE' : 'IDLE') as SprintRecord['state'],
            active_channels: ['meta'],
            budget_cents: 50000,
            created_at: json2.test?.created_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
      setSprintData(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (activeSprint) loadSprintDetail(activeSprint);
  }, [activeSprint, loadSprintDetail]);

  // ── Poll active sprint ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeSprint) return;
    const running = sprintData?.state && ['GENOME_RUNNING','HEALTHGATE_RUNNING','ANGLES_RUNNING','LANDING_RUNNING','CAMPAIGN_RUNNING','CAMPAIGN_MONITORING','VERDICT_GENERATING'].includes(sprintData.state);
    if (!running) return;
    const interval = setInterval(() => loadSprintDetail(activeSprint), 8000);
    return () => clearInterval(interval);
  }, [activeSprint, sprintData?.state, loadSprintDetail]);

  // ── Sync nodes / edges ───────────────────────────────────────────────────
  useEffect(() => {
    const n = buildNodes(sprintData);
    // Inject connected platforms count into accounts node
    n[0] = { ...n[0], data: { ...n[0].data, connectedCount: connectedPlatforms.length } };
    setNodes(n);
    setEdges(buildEdges(sprintData));
  }, [sprintData, connectedPlatforms.length, setEdges, setNodes]);

  // ── Node click handler ───────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    const id = node.id;
    if (id === 'accounts')   { setActivePanel('accounts');   setPanelChannel(undefined); return; }
    if (id === 'genome')     { setActivePanel('genome');     setPanelChannel(undefined); return; }
    if (id.startsWith('hg-')) {
      setActivePanel('healthgate');
      setPanelChannel(id.replace('hg-', ''));
      return;
    }
    if (id === 'angles')     { setActivePanel('angles');     setPanelChannel(undefined); return; }
    if (id === 'landing')    { setActivePanel('landing');    setPanelChannel(undefined); return; }
    if (id.startsWith('campaign-')) {
      setActivePanel('campaign');
      setPanelChannel(id.replace('campaign-', ''));
      return;
    }
    if (id === 'verdict')    { setActivePanel('verdict');    setPanelChannel(undefined); return; }
    if (id === 'report')     { setActivePanel('report');     setPanelChannel(undefined); return; }
    if (id === 'benchmarks') { setActivePanel('benchmarks'); setPanelChannel(undefined); return; }
    if (id === 'settings')   { setActivePanel('settings');   setPanelChannel(undefined); return; }
  }, []);

  const runSprintPipeline = useCallback(async (id: string) => {
    setPipelineError(null);
    setPipelineRunning(true);
    try {
      let current = await loadSprintDetail(id);
      if (!current) throw new Error('Sprint could not be loaded');

      if (current.state === 'BLOCKED') {
        throw new Error(current.blocked_reason ?? 'Sprint is blocked');
      }

      if (current.state === 'IDLE') {
        setActivePanel('genome');
        setSprintData((prev) => prev && prev.sprint_id === id ? { ...prev, state: 'GENOME_RUNNING' } : prev);
        const res = await fetch(`/api/sprint/${id}/genome`, { method: 'POST' });
        if (!res.ok) throw new Error((await res.json()).error ?? 'Genome failed');
        current = await loadSprintDetail(id);
        if (!current || current.state === 'BLOCKED') return;
      }

      if (current.state === 'GENOME_DONE') {
        setActivePanel('healthgate');
        setSprintData((prev) => prev && prev.sprint_id === id ? { ...prev, state: 'HEALTHGATE_RUNNING' } : prev);
        const res = await fetch(`/api/sprint/${id}/healthgate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel_data: DEMO_HEALTHGATE_DATA }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? 'Healthgate failed');
        current = await loadSprintDetail(id);
        if (!current || current.state === 'BLOCKED') return;
      }

      if (current.state === 'HEALTHGATE_DONE') {
        setActivePanel('angles');
        setSprintData((prev) => prev && prev.sprint_id === id ? { ...prev, state: 'ANGLES_RUNNING' } : prev);
        const res = await fetch(`/api/sprint/${id}/angles`, { method: 'POST' });
        if (!res.ok) throw new Error((await res.json()).error ?? 'Angles failed');
        current = await loadSprintDetail(id);
        if (!current || current.state === 'BLOCKED') return;
      }

      if (current.state === 'ANGLES_DONE' || current.state === 'LANDING_RUNNING' || current.state === 'LANDING_DONE') {
        setActivePanel('landing');
        setSprintData((prev) => prev && prev.sprint_id === id ? { ...prev, state: 'LANDING_RUNNING' } : prev);
        const res = await fetch(`/api/sprint/${id}/demo-complete`, { method: 'POST' });
        if (!res.ok) throw new Error((await res.json()).error ?? 'Demo completion failed');
        await loadSprintDetail(id);
        setActivePanel('verdict');
      }
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Sprint pipeline failed');
      await loadSprintDetail(id);
    } finally {
      setPipelineRunning(false);
    }
  }, [loadSprintDetail]);

  const handleCreated = (sprint: SprintRecord) => {
    setSprints((prev) => [{ id: sprint.sprint_id, name: sprint.idea, status: 'idle' }, ...prev]);
    setActiveSprint(sprint.sprint_id);
    setSprintData(sprint);
    setActivePanel('genome');
    setShowNew(false);
    void runSprintPipeline(sprint.sprint_id);
  };

  const handleEditSetup = (sprintId: string) => {
    setActiveSprint(sprintId);
    setActivePanel('campaign');
    setPanelChannel(undefined);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#FAFAF8', position: 'relative', fontFamily: 'inherit' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={() => setActivePanel(null)}
        fitView
        fitViewOptions={{ padding: 0.22, maxZoom: 1.05 }}
        minZoom={0.3}
        maxZoom={1.7}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#E8E4DC" />

        <Panel position="top-left" style={{ margin: 14 }}>
          <CanvasToolbar
            sprints={sprints}
            activeSprint={activeSprint}
            onSelect={(id) => { setActiveSprint(id); setActivePanel(null); }}
            onNew={() => setShowNew(true)}
            onOpenPanel={(panel) => { setActivePanel(panel as PanelId); setPanelChannel(undefined); }}
          />
        </Panel>

        {activePanel && (
          <Panel position="top-right" style={{ margin: 14 }}>
            <NodePanel
              panel={activePanel}
              channel={panelChannel}
              sprint={sprintData}
              onClose={() => setActivePanel(null)}
              onEditSetup={handleEditSetup}
              onRunWorkflow={(id) => void runSprintPipeline(id)}
              workflowRunning={pipelineRunning}
              embedded
            />
          </Panel>
        )}

        {sprintData?.state && (
          <Panel position="bottom-center" style={{ marginBottom: 16 }}>
            <StateLabel state={sprintData.state} />
          </Panel>
        )}

        {pipelineError && (
          <Panel position="bottom-right" style={{ margin: 16 }}>
            <div style={{ maxWidth: 360, padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, color: '#DC2626', fontSize: '0.8125rem' }}>
              {pipelineError}
            </div>
          </Panel>
        )}

        {!activeSprint && sprints.length === 0 && (
          <Panel position="top-center" style={{ marginTop: 120, pointerEvents: 'none' }}>
            <div style={{ width: 360, background: '#FFFFFF', border: '1px solid #E8E4DC', borderRadius: 16, padding: 22, textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8C8880', marginBottom: 8 }}>No sprints yet</p>
              <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111110', marginBottom: 4 }}>Start your first validation</p>
              <p style={{ fontSize: '0.875rem', color: '#8C8880', margin: 0 }}>Use New Sprint to watch Genome, Healthgate, Angles, Landing, Campaign, Verdict, and Report in one canvas.</p>
            </div>
          </Panel>
        )}

        <Controls
          position="bottom-left"
          style={{ margin: 16, boxShadow: 'none', border: '1px solid #E8E4DC', borderRadius: 10, overflow: 'hidden' }}
        />
      </ReactFlow>

      {/* New Sprint modal */}
      <AnimatePresence>
        {showNew && <NewSprintModal onClose={() => setShowNew(false)} onCreated={handleCreated} />}
      </AnimatePresence>
    </div>
  );
}

// ── Exported component wrapped in ReactFlowProvider ──────────────────────────
export function SprintCanvas({ initialPanel, initialSprint, openNew }: CanvasProps = {}) {
  return (
    <ReactFlowProvider>
      <CanvasInner initialPanel={initialPanel} initialSprint={initialSprint} openNew={openNew} />
    </ReactFlowProvider>
  );
}
