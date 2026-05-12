'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow, Background, BackgroundVariant, applyNodeChanges,
  Controls, type Node, type Edge, type NodeTypes, type EdgeTypes, type NodeMouseHandler, type NodeChange,
  ReactFlowProvider, Panel, useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { CanvasToolbar } from './canvas-toolbar';
import { NodePanel, type PanelId } from './node-panel';
import { PipelineEdge, type EdgeState } from './pipeline-edge';
import {
  AccountsNode, GenomeNode, HealthgateNode, AnglesNode,
  CreativeNode, LandingNode, CampaignNode, VerdictNode, ReportNode,
  SpreadsheetNode, OutreachNode, SlackNode, SettingsNode,
  BudgetNode,
} from './canvas-nodes';
import type { Angle, Platform, SprintRecord, SprintState } from '@/lib/agents/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { captureEvent } from '@/lib/analytics/client';
import { useSprintRealtime } from '@/lib/use-sprint-realtime';

// ── Node & Edge type registries ──────────────────────────────────────────────
const NODE_TYPES: NodeTypes = {
  accounts:   AccountsNode,
  genome:     GenomeNode,
  healthgate: HealthgateNode,
  budget:     BudgetNode,
  angles:     AnglesNode,
  creative:   CreativeNode,
  landing:    LandingNode,
  campaign:   CampaignNode,
  verdict:    VerdictNode,
  report:     ReportNode,
  spreadsheet: SpreadsheetNode,
  outreach:   OutreachNode,
  slack:      SlackNode,
  settings:   SettingsNode,
};

const EDGE_TYPES: EdgeTypes = { pipeline: PipelineEdge };

// ── Layout constants ─────────────────────────────────────────────────────────
// React Flow positions are top-left coordinates. Keep dimensions centralized so
// the layout can reserve real bounding boxes instead of relying on visual guesses.
const NODE_SIZE = {
  /** Matches default NodeCard width — wider than legacy 168 so lanes feel proportional */
  standard: { width: 192, height: 108 },
  creative: { width: 248, height: 352 },
  landing: { width: 248, height: 352 },
};
/** Vertical rhythm between stacked channel rows (creative / campaign / hg) */
const LANE_GAP_MIN = 56;
const LANE_GAP_MAX = 96;
/** Space below the main workflow stack before utility row (benchmarks / settings) */
const LAYOUT = {
  left: 72,
  top: 128,
  utilityGapMin: 96,
  utilityGapMax: 140,
};
const CHANNELS = ['meta', 'google', 'linkedin', 'tiktok'] as const;

const LOG_PREFIX = '[canvas-workflow]';

/** Dev logs by default; set localStorage CANVAS_WORKFLOW_LOG=0 to mute, or NEXT_PUBLIC_CANVAS_WORKFLOW_LOG=1 in prod. */
function canvasWorkflowLogEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_CANVAS_WORKFLOW_LOG === '1') return true;
  try {
    if (globalThis.localStorage?.getItem('CANVAS_WORKFLOW_LOG') === '0') return false;
  } catch {
    /* private mode */
  }
  if (process.env.NEXT_PUBLIC_CANVAS_WORKFLOW_LOG === '0') return false;
  return process.env.NODE_ENV === 'development';
}

function stripePaymentGateFromEnv(): boolean {
  return process.env.NEXT_PUBLIC_STRIPE_PAYMENT_GATE === '1' || process.env.NEXT_PUBLIC_STRIPE_PAYMENT_GATE === 'true';
}

/** Horizontal gap after column `leftW` before column `rightW` — separated enough that each edge reads as its own step. */
function horizontalGapBetween(leftW: number, rightW: number): number {
  const wideThreshold = Math.min(NODE_SIZE.creative.width, NODE_SIZE.landing.width) - 12;
  const std = NODE_SIZE.standard.width;
  const l = leftW >= wideThreshold || rightW >= wideThreshold;
  const bothStd = leftW <= std + 8 && rightW <= std + 8;
  if (bothStd) return 128;
  if (l) return 164;
  return 144;
}

/** X positions derived from actual column widths so spacing scales with card size (dynamic packing) */
function computeColumnLeftEdges(includeBudget: boolean): Record<string, number> {
  // v9: managed-account architecture — healthgate lane removed from default path
  const columns: [string, number][] = [
    ['accounts', NODE_SIZE.standard.width],
    ['genome', NODE_SIZE.standard.width],
  ];
  if (includeBudget) columns.push(['budget', NODE_SIZE.standard.width]);
  columns.push(
    ['angles', NODE_SIZE.standard.width],
    ['creative', NODE_SIZE.creative.width],
    ['campaign', NODE_SIZE.standard.width],
    ['verdict', NODE_SIZE.standard.width],
    ['landing', NODE_SIZE.landing.width],
    ['report', NODE_SIZE.standard.width],
  );

  let cursor = LAYOUT.left;
  const acc: Record<string, number> = {};
  for (let i = 0; i < columns.length; i++) {
    const [key, width] = columns[i];
    acc[key] = cursor;
    const next = columns[i + 1];
    if (!next) break;
    cursor += width + horizontalGapBetween(width, next[1]);
  }
  return acc;
}

type CreativeDraft = {
  channel: Platform;
  angleId: Angle['id'];
  angle: Angle;
  brandName: string;
  image: string | null;
};
type CreativeDrafts = Partial<Record<Platform, CreativeDraft>>;
type LandingDraft = {
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

// ── Sprint state → node/edge stage mapping ───────────────────────────────────
type NodeStage = 'idle' | 'running' | 'done' | 'blocked' | 'warn';

function sprintStageFor(nodeId: string, sprintState?: SprintState, sprint?: SprintRecord | null): NodeStage {
  if (!sprintState || sprintState === 'IDLE') return 'idle';
  const s = sprintState;

  if (nodeId === 'accounts') return 'done';
  if (nodeId === 'genome') {
    if (s === 'GENOME_RUNNING') return 'running';
    if (s === 'BLOCKED') return 'blocked';
    return 'done'; // any non-IDLE, non-BLOCKED state means genome is done
  }
  if (nodeId === 'budget') {
    if (s === 'PAYMENT_PENDING') return 'running';
    if (['ANGLES_RUNNING','ANGLES_DONE','LANDING_RUNNING','LANDING_DONE','CAMPAIGN_RUNNING','CAMPAIGN_MONITORING','VERDICT_GENERATING','COMPLETE'].includes(s)) return 'done';
    // GENOME_DONE or legacy HEALTHGATE_DONE both unlock budget selection
    if (s === 'GENOME_DONE' || s === 'HEALTHGATE_DONE') return 'warn';
    return 'idle';
  }
  if (nodeId === 'angles') {
    if (s === 'ANGLES_RUNNING') return 'running';
    if (['ANGLES_DONE','LANDING_RUNNING','LANDING_DONE','CAMPAIGN_RUNNING','CAMPAIGN_MONITORING','VERDICT_GENERATING','COMPLETE'].includes(s)) return 'done';
    return 'idle';
  }
  if (nodeId.startsWith('creative-')) {
    const channel = nodeId.replace('creative-', '') as Platform;
    if (sprint && !sprint.active_channels.includes(channel)) return 'idle';
    if (s === 'ANGLES_RUNNING') return 'running';
    if (['ANGLES_DONE','LANDING_RUNNING','LANDING_DONE','CAMPAIGN_RUNNING','CAMPAIGN_MONITORING','VERDICT_GENERATING','COMPLETE'].includes(s)) return 'done';
    return 'idle';
  }
  if (nodeId === 'landing') {
    if (s === 'LANDING_RUNNING') return 'running';
    if (s === 'LANDING_DONE') return 'done';
    if (s === 'COMPLETE' && sprint?.verdict?.verdict === 'GO') return 'warn';
    return 'idle';
  }
  if (nodeId.startsWith('campaign-')) {
    const channel = nodeId.replace('campaign-', '') as Platform;
    if (sprint && !sprint.active_channels.includes(channel)) return 'idle';
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
  if (nodeId === 'spreadsheet') {
    if (s !== 'COMPLETE') return 'idle';
    const phase = sprint?.post_sprint?.phase;
    if (phase === 'spreadsheet_running') return 'running';
    if (phase && phase !== 'idle') return 'done';
    return 'idle';
  }
  if (nodeId === 'outreach') {
    if (s !== 'COMPLETE') return 'idle';
    const phase = sprint?.post_sprint?.phase;
    if (phase === 'outreach_running') return 'running';
    if (phase === 'outreach_failed' || ((sprint?.post_sprint?.outreach?.failed ?? 0) > 0 && (sprint?.post_sprint?.outreach?.totalSent ?? 0) === 0)) return 'blocked';
    if (phase === 'outreach_confirm') return 'warn';
    if (phase && ['outreach_done', 'slack_running', 'slack_done', 'complete'].includes(phase)) return 'done';
    return 'idle';
  }
  if (nodeId === 'slack') {
    if (s !== 'COMPLETE') return 'idle';
    const phase = sprint?.post_sprint?.phase;
    if (phase === 'slack_running') return 'running';
    if (phase === 'complete' || sprint?.post_sprint?.slack?.posted) return 'done';
    return 'idle';
  }
  return 'idle';
}

function edgeStageFor(edgeId: string, sprintState?: SprintState, sprint?: SprintRecord | null): EdgeState {
  if (!sprintState || sprintState === 'IDLE') return 'pending';
  const s = sprintState;

  // For BLOCKED, treat completed stages as done based on persisted data
  const hasAngles   = Boolean(sprint?.angles);
  const hasCampaign = Boolean(sprint?.campaign);
  const hasVerdict  = Boolean(sprint?.verdict);

  const CAMPAIGN_STATES = ['CAMPAIGN_RUNNING','CAMPAIGN_MONITORING','VERDICT_GENERATING','COMPLETE'] as SprintState[];
  const POST_ANGLES = ['ANGLES_DONE','LANDING_RUNNING','LANDING_DONE',...CAMPAIGN_STATES] as SprintState[];

  if (edgeId === 'e-accounts-genome') {
    if (s === 'GENOME_RUNNING') return 'running';
    return 'done';
  }
  // v9 managed path: genome connects directly to budget or angles — no healthgate
  if (edgeId === 'e-genome-budget') {
    if (s === 'GENOME_DONE' || s === 'PAYMENT_PENDING' || s === 'ANGLES_RUNNING') return 'running';
    if (POST_ANGLES.includes(s) || (s === 'BLOCKED' && hasAngles)) return 'done';
    return 'pending';
  }
  if (edgeId === 'e-genome-angles') {
    if (s === 'GENOME_DONE' || s === 'ANGLES_RUNNING') return 'running';
    if (POST_ANGLES.includes(s) || (s === 'BLOCKED' && hasAngles)) return 'done';
    return 'pending';
  }
  if (edgeId === 'e-budget-angles') {
    if (s === 'PAYMENT_PENDING' || s === 'ANGLES_RUNNING') return 'running';
    if (POST_ANGLES.includes(s) || (s === 'BLOCKED' && hasAngles)) return 'done';
    return 'pending';
  }
  if (edgeId.startsWith('e-angles-creative-')) {
    if (s === 'ANGLES_RUNNING') return 'running';
    if (POST_ANGLES.includes(s) || (s === 'BLOCKED' && hasAngles)) return 'done';
  }
  if (edgeId.startsWith('e-creative-') && edgeId.includes('-campaign-')) {
    if (['VERDICT_GENERATING','COMPLETE'].includes(s)) return 'done';
    if (['CAMPAIGN_RUNNING','CAMPAIGN_MONITORING'].includes(s)) return 'running';
    if (s === 'BLOCKED' && hasCampaign) return 'done';
    // Campaign hasn't started yet — show as a visible upcoming step, not invisible
    return 'pending';
  }
  if (edgeId.startsWith('e-campaign-') && edgeId.endsWith('-verdict')) {
    if (s === 'VERDICT_GENERATING') return 'running';
    if (s === 'COMPLETE') return 'done';
    if (['CAMPAIGN_RUNNING','CAMPAIGN_MONITORING'].includes(s)) return 'running';
    if (s === 'BLOCKED' && hasVerdict) return 'done';
  }
  if (edgeId === 'e-verdict-report') {
    if (s === 'COMPLETE') return 'done';
    if (s === 'VERDICT_GENERATING') return 'running';
    if (s === 'BLOCKED' && hasVerdict) return 'done';
  }
  if (edgeId === 'e-verdict-landing') {
    if (s === 'LANDING_RUNNING') return 'running';
    if (s === 'LANDING_DONE') return 'done';
    if (s === 'COMPLETE') return 'warn';
  }
  return 'pending';
}

function channelEdgeState(edgeId: string, channel: Platform, sprint: SprintRecord | null, fallback: EdgeState): EdgeState {
  if (sprint && !sprint.active_channels.includes(channel)) return 'pending';
  return edgeStageFor(edgeId, sprint?.state, sprint) ?? fallback;
}

function activeChannelsFor(sprint: SprintRecord | null): Platform[] {
  return sprint?.active_channels?.length ? sprint.active_channels : [...CHANNELS];
}

// ── Strict per-stage node revelation ─────────────────────────────────────────
// Nodes are ONLY shown once the workflow has entered that stage.
// No "upcoming preview" nodes — this prevents the post-payment node explosion.

/** Creative nodes appear as soon as angles are done (they ARE the angle output). */
const CREATIVE_VISIBLE: SprintState[] = [
  'ANGLES_DONE',
  'LANDING_RUNNING', 'LANDING_DONE',
  'CAMPAIGN_RUNNING', 'CAMPAIGN_MONITORING',
  'VERDICT_GENERATING', 'COMPLETE',
];

/** Landing page node: only visible once landing actually starts. */
const LANDING_VISIBLE: SprintState[] = [
  'LANDING_RUNNING', 'LANDING_DONE',
  'CAMPAIGN_RUNNING', 'CAMPAIGN_MONITORING',
  'VERDICT_GENERATING', 'COMPLETE',
];

/** Campaign nodes: only visible once campaign starts. */
const CAMPAIGN_VISIBLE: SprintState[] = [
  'CAMPAIGN_RUNNING', 'CAMPAIGN_MONITORING',
  'VERDICT_GENERATING', 'COMPLETE',
];

/** Verdict node: only visible once verdict is being generated. */
const VERDICT_VISIBLE: SprintState[] = ['VERDICT_GENERATING', 'COMPLETE'];

/** Report / post-sprint nodes: only after sprint is fully complete. */
const REPORT_VISIBLE: SprintState[] = ['COMPLETE'];

/** Keep PIPELINE_TAIL_VISIBLE for edge state helpers that still reference it. */
const PIPELINE_TAIL_VISIBLE: SprintState[] = CREATIVE_VISIBLE;

type NodeDiscovery = { visible: boolean; reason: string };

function nodeDiscovery(nodeId: string, sprint: SprintRecord | null): NodeDiscovery {
  const s = sprint?.state;
  if (nodeId === 'accounts') return { visible: true, reason: 'accounts: always' };
  if (!s || s === 'IDLE') {
    return { visible: false, reason: `hidden: sprint state is ${s === 'IDLE' ? 'IDLE' : 'missing'} (workflow not started)` };
  }

  if (nodeId === 'genome') return { visible: true, reason: 'genome: always once past IDLE' };
  if (s === 'BLOCKED') {
    if (nodeId === 'angles') {
      const ok = Boolean(sprint?.angles);
      return { visible: ok, reason: ok ? 'blocked+angles' : 'blocked: no angles blob' };
    }
    if (nodeId.startsWith('creative-')) {
      const ok = Boolean(sprint?.angles);
      return { visible: ok, reason: ok ? 'blocked+creative (angles exists)' : 'blocked: no angles for creative' };
    }
    if (nodeId === 'landing') {
      const ok = Boolean(sprint?.landing);
      return { visible: ok, reason: ok ? 'blocked+landing' : 'blocked: no landing blob' };
    }
    if (nodeId.startsWith('campaign-')) {
      const ok = Boolean(sprint?.campaign);
      return { visible: ok, reason: ok ? 'blocked+campaign' : 'blocked: no campaign blob' };
    }
    if (nodeId === 'verdict') {
      const ok = Boolean(sprint?.verdict);
      return { visible: ok, reason: ok ? 'blocked+verdict' : 'blocked: no verdict blob' };
    }
    if (nodeId === 'report') {
      const ok = Boolean(sprint?.report);
      return { visible: ok, reason: ok ? 'blocked+report' : 'blocked: no report blob' };
    }
    if (nodeId === 'budget') return { visible: false, reason: 'blocked: budget hidden' };
    if (nodeId === 'spreadsheet') {
      const ok = Boolean(sprint?.integrations?.canvas_sheet);
      return { visible: ok, reason: ok ? 'blocked+spreadsheet flag' : 'blocked: canvas_sheet false' };
    }
    if (nodeId === 'outreach') {
      const ok = Boolean(sprint?.integrations?.canvas_outreach);
      return { visible: ok, reason: ok ? 'blocked+outreach flag' : 'blocked: canvas_outreach false' };
    }
    if (nodeId === 'slack') {
      const ok = Boolean(sprint?.integrations?.canvas_slack);
      return { visible: ok, reason: ok ? 'blocked+slack flag' : 'blocked: canvas_slack false' };
    }
    return { visible: false, reason: 'blocked: unhandled node id' };
  }

  // v9: angles appear as soon as genome clears — no healthgate wait
  const angleStates: SprintState[] = [
    'GENOME_DONE', 'HEALTHGATE_DONE', 'PAYMENT_PENDING', 'ANGLES_RUNNING', 'ANGLES_DONE',
    'LANDING_RUNNING', 'LANDING_DONE', 'CAMPAIGN_RUNNING', 'CAMPAIGN_MONITORING', 'VERDICT_GENERATING', 'COMPLETE',
  ];
  if (nodeId === 'budget') {
    if (!stripePaymentGateFromEnv()) return { visible: false, reason: 'stripe gate off' };
    // Budget is visible from GENOME_DONE onward — it persists as a historical
    // record of the payment step even after the sprint fully completes.
    // Hidden only while genome is still running (GENOME_RUNNING, HEALTHGATE_RUNNING).
    // IDLE and BLOCKED are already handled by the early-returns above.
    const hidden = (s === 'GENOME_RUNNING' || s === 'HEALTHGATE_RUNNING');
    return { visible: !hidden, reason: !hidden ? `budget: visible in ${s}` : `budget: hidden while genome/hg running (${s})` };
  }
  if (nodeId === 'angles') {
    const ok = angleStates.includes(s);
    return { visible: ok, reason: ok ? `angles: state ${s} ok` : `angles: state ${s} before angle window` };
  }
  if (nodeId.startsWith('creative-')) {
    const ok = CREATIVE_VISIBLE.includes(s);
    return { visible: ok, reason: ok ? `creative: state ${s} in CREATIVE_VISIBLE` : `creative: hidden — workflow not yet at ANGLES_DONE (current: ${s})` };
  }
  if (nodeId === 'landing') {
    const ok = LANDING_VISIBLE.includes(s);
    return {
      visible: ok,
      reason: ok ? `landing: state ${s} in LANDING_VISIBLE` : `landing: hidden — workflow not yet at LANDING_RUNNING (current: ${s})`,
    };
  }
  if (nodeId.startsWith('campaign-')) {
    const ok = CAMPAIGN_VISIBLE.includes(s);
    return {
      visible: ok,
      reason: ok ? `campaign: state ${s} in CAMPAIGN_VISIBLE` : `campaign: hidden — workflow not yet at CAMPAIGN_RUNNING (current: ${s})`,
    };
  }
  if (nodeId === 'verdict') {
    const ok = VERDICT_VISIBLE.includes(s);
    return { visible: ok, reason: ok ? `verdict: state ${s}` : `verdict: hidden — workflow not yet at VERDICT_GENERATING (current: ${s})` };
  }
  if (nodeId === 'report') {
    const ok = REPORT_VISIBLE.includes(s);
    return { visible: ok, reason: ok ? `report: COMPLETE` : `report: hidden — workflow not yet COMPLETE (current: ${s})` };
  }

  if (nodeId === 'spreadsheet') {
    const flag = Boolean(sprint?.integrations?.canvas_sheet);
    const complete = REPORT_VISIBLE.includes(s);
    if (!flag) {
      return { visible: false, reason: 'spreadsheet: integrations.canvas_sheet is false' };
    }
    if (!complete) {
      return { visible: false, reason: `spreadsheet: hidden — sprint not yet COMPLETE (current: ${s})` };
    }
    return { visible: true, reason: 'spreadsheet: COMPLETE + canvas_sheet flag' };
  }
  if (nodeId === 'outreach') {
    const flag = Boolean(sprint?.integrations?.canvas_outreach);
    if (!flag) return { visible: false, reason: 'outreach: canvas_outreach false' };
    if (!REPORT_VISIBLE.includes(s)) return { visible: false, reason: `outreach: hidden — sprint not yet COMPLETE (current: ${s})` };
    return { visible: true, reason: 'outreach: COMPLETE + flag' };
  }
  if (nodeId === 'slack') {
    const flag = Boolean(sprint?.integrations?.canvas_slack);
    if (!flag) return { visible: false, reason: 'slack: canvas_slack false' };
    if (!REPORT_VISIBLE.includes(s)) return { visible: false, reason: `slack: hidden — sprint not yet COMPLETE (current: ${s})` };
    return { visible: true, reason: 'slack: COMPLETE + flag' };
  }

  return { visible: false, reason: `unclassified node id: ${nodeId}` };
}

function isNodeDiscovered(nodeId: string, sprint: SprintRecord | null): boolean {
  return nodeDiscovery(nodeId, sprint).visible;
}

function buildLayout(channelCount: number) {
  const safeChannelCount = Math.max(1, Math.min(CHANNELS.length, channelCount));
  const laneHeight = NODE_SIZE.creative.height;
  /** Scale lane spacing from channel count — busier canvases pack slightly tighter */
  const laneGap = Math.round(
    LANE_GAP_MIN + ((LANE_GAP_MAX - LANE_GAP_MIN) * Math.max(0, CHANNELS.length - safeChannelCount)) / CHANNELS.length,
  );
  const lanePitch = laneHeight + laneGap;
  const workflowHeight = safeChannelCount * laneHeight + Math.max(0, safeChannelCount - 1) * laneGap;
  const fullWorkflowHeight = CHANNELS.length * laneHeight + Math.max(0, CHANNELS.length - 1) * LANE_GAP_MIN;
  /** Center sparse channel selections inside the full workflow frame so Meta/Campaign do not float at the top. */
  const laneTopBase = LAYOUT.top + Math.max(0, fullWorkflowHeight - workflowHeight) / 2;
  const workflowCenter = laneTopBase + workflowHeight / 2;
  const standardTop = workflowCenter - NODE_SIZE.standard.height / 2;
  const utilityGap = Math.round(
    LAYOUT.utilityGapMin + ((LAYOUT.utilityGapMax - LAYOUT.utilityGapMin) * Math.max(0, CHANNELS.length - safeChannelCount)) / CHANNELS.length,
  );
  const utilityTop = laneTopBase + workflowHeight + utilityGap;

  return {
    standardTop,
    utilityTop,
    laneTop(index: number, nodeHeight = NODE_SIZE.standard.height) {
      const laneCenter = laneTopBase + index * lanePitch + laneHeight / 2;
      return laneCenter - nodeHeight / 2;
    },
  };
}

function nodeSize(node: Node) {
  if (node.type === 'landing') return NODE_SIZE.landing;
  return node.type === 'creative' ? NODE_SIZE.creative : NODE_SIZE.standard;
}

function overlaps(a: Node, b: Node, padding = 28) {
  const aSize = nodeSize(a);
  const bSize = nodeSize(b);
  const ax2 = a.position.x + aSize.width + padding;
  const ay2 = a.position.y + aSize.height + padding;
  const bx2 = b.position.x + bSize.width + padding;
  const by2 = b.position.y + bSize.height + padding;

  return a.position.x < bx2 && ax2 > b.position.x && a.position.y < by2 && ay2 > b.position.y;
}

/** Vertical nudge when two nodes overlap — aligned with typical lane rhythm */
const OVERLAP_RESOLVE_GAP = 72;

function resolveNodeOverlaps(input: Node[]) {
  const nodes = input
    .map((node) => ({ ...node, position: { ...node.position } }))
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      if (!overlaps(nodes[j], nodes[i])) continue;
      const previousSize = nodeSize(nodes[j]);
      nodes[i].position.y = nodes[j].position.y + previousSize.height + OVERLAP_RESOLVE_GAP;
      j = -1; // Restart because moving against one rectangle can create a new intersection.
    }
  }

  const byId = new Map(nodes.map((node) => [node.id, node.position]));
  return input.map((node) => ({ ...node, position: byId.get(node.id) ?? node.position }));
}

function selectedAngleFor(sprint: SprintRecord | null): Angle | undefined {
  const angles = sprint?.angles?.angles;
  if (!angles?.length) return undefined;
  const selectedAngleId = (sprint?.angles as { selected_angle_id?: Angle['id'] } | undefined)?.selected_angle_id;
  return angles.find((angle) => angle.id === selectedAngleId) ?? angles[0];
}

function creativeDataFor(channel: Platform, sprint: SprintRecord | null, drafts: CreativeDrafts) {
  const selectedAngle = selectedAngleFor(sprint);
  const draft = drafts[channel];
  /** Prefer in-memory draft angle whenever present — panel may switch angles before PATCH saves `selected_angle_id`. */
  const angle = draft?.angle ?? selectedAngle;
  const assets = (sprint?.angles as { creative_assets?: Partial<Record<Platform, { brand_name?: string; image?: string | null }>> } | undefined)?.creative_assets?.[channel];
  const brandName = draft?.brandName ?? assets?.brand_name ?? 'Your Brand';
  const image = draft?.image ?? assets?.image ?? null;

  if (!angle) {
    return { channel, stage: sprintStageFor(`creative-${channel}`, sprint?.state, sprint) };
  }

  if (channel === 'meta') {
    return {
      channel, selectedAngle: angle.id, brandName, image, cta: angle.cta,
      title: angle.copy.meta.headline,
      body: angle.copy.meta.body,
      stage: sprintStageFor(`creative-${channel}`, sprint?.state, sprint),
    };
  }
  if (channel === 'google') {
    return {
      channel, selectedAngle: angle.id, brandName, image, cta: angle.cta,
      title: `${angle.copy.google.headline1} | ${angle.copy.google.headline2}`,
      body: angle.copy.google.description,
      stage: sprintStageFor(`creative-${channel}`, sprint?.state, sprint),
    };
  }
  if (channel === 'linkedin') {
    return {
      channel, selectedAngle: angle.id, brandName, image, cta: angle.cta,
      title: angle.copy.linkedin.headline,
      body: angle.copy.linkedin.intro || angle.copy.linkedin.body,
      stage: sprintStageFor(`creative-${channel}`, sprint?.state, sprint),
    };
  }
  return {
    channel, selectedAngle: angle.id, brandName, image, cta: angle.cta,
    title: angle.copy.tiktok.hook,
    body: angle.copy.tiktok.overlay,
    stage: sprintStageFor(`creative-${channel}`, sprint?.state, sprint),
  };
}

function landingDraftFor(sprint: SprintRecord | null, draft?: LandingDraft | null) {
  const selectedAngle = selectedAngleFor(sprint);
  const firstPage = sprint?.landing?.pages?.[0] as {
    url?: string;
    sections?: Array<{ headline?: string; subheadline?: string; cta_label?: string; bullets?: string[]; quote?: string }>;
  } | undefined;

  const hero = firstPage?.sections?.[0];
  const proof = firstPage?.sections?.[1];
  const trust = firstPage?.sections?.[3];

  return {
    pageCount: sprint?.landing?.pages?.length,
    url: firstPage?.url ?? null,
    mode: draft?.mode ?? 'builder',
    theme: draft?.theme ?? 'studio',
    eyebrow: draft?.eyebrow ?? 'LaunchLense validation sprint',
    headline: draft?.headline ?? hero?.headline ?? selectedAngle?.copy.meta.headline,
    subheadline: draft?.subheadline ?? hero?.subheadline ?? selectedAngle?.copy.meta.body,
    cta: draft?.cta ?? hero?.cta_label ?? selectedAngle?.cta,
    proof: draft?.proof ?? proof?.bullets,
    testimonial: draft?.testimonial ?? trust?.quote,
    customHtml: draft?.customHtml,
    customCss: draft?.customCss,
  };
}

function draftFingerprint(draft: CreativeDraft) {
  return JSON.stringify({
    channel: draft.channel,
    angleId: draft.angleId,
    brandName: draft.brandName,
    image: draft.image,
    cta: draft.angle.cta,
    copy: draft.angle.copy,
  });
}

function landingFingerprint(draft: LandingDraft) {
  return JSON.stringify(draft);
}

function nodeDataLooselyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function isWorkflowAutoLayoutNode(id: string): boolean {
  return [
    'accounts',
    'genome',
    'angles',
    'landing',
    'verdict',
    'report',
    'spreadsheet',
    'outreach',
    'slack',
    'budget',
  ].includes(id) ||
    id.startsWith('creative-') ||
    id.startsWith('campaign-');
}

function mergeCanvasNodes(current: Node[], nextBase: Node[]) {
  if (!current.length) return nextBase;

  const currentById = new Map(current.map((node) => [node.id, node]));
  let changed = current.length !== nextBase.length;

  const next = nextBase.map((baseNode) => {
    const currentNode = currentById.get(baseNode.id);
    if (!currentNode) {
      changed = true;
      return baseNode;
    }

    const merged = {
      ...currentNode,
      ...baseNode,
      position: isWorkflowAutoLayoutNode(baseNode.id) ? baseNode.position : currentNode.position,
      selected: currentNode.selected,
      dragging: currentNode.dragging,
      measured: currentNode.measured,
      width: currentNode.width,
      height: currentNode.height,
    };

    if (
      currentNode.type !== baseNode.type ||
      !nodeDataLooselyEqual(currentNode.data, baseNode.data) ||
      currentNode.position.x !== merged.position.x ||
      currentNode.position.y !== merged.position.y ||
      currentNode.measured?.width !== merged.measured?.width ||
      currentNode.measured?.height !== merged.measured?.height
    ) {
      changed = true;
    }

    return merged;
  });

  return changed ? next : current;
}

function meaningfulNodeChanges(changes: NodeChange[], currentNodes: Node[]) {
  const currentById = new Map(currentNodes.map((node) => [node.id, node]));

  return changes.filter((change) => {
    if (!('id' in change)) return true;
    const current = currentById.get(change.id);
    if (!current) return true;

    if (change.type === 'position') {
      if (!change.position) return true;
      return current.position.x !== change.position.x ||
        current.position.y !== change.position.y ||
        current.dragging !== change.dragging;
    }

    if (change.type === 'dimensions') {
      const dimensions = change.dimensions;
      if (!dimensions) return true;
      const currentWidth = current.measured?.width ?? current.width;
      const currentHeight = current.measured?.height ?? current.height;
      return currentWidth !== dimensions.width ||
        currentHeight !== dimensions.height;
    }

    if (change.type === 'select') return current.selected !== change.selected;

    return true;
  });
}

// ── Build static node list ───────────────────────────────────────────────────
function buildNodes(sprint: SprintRecord | null, creativeDrafts: CreativeDrafts, landingDraft: LandingDraft | null): Node[] {
  const includeBudget = stripePaymentGateFromEnv();
  const X = computeColumnLeftEdges(includeBudget);
  const s  = sprint?.state;
  const g  = sprint?.genome;
  const a  = sprint?.angles;
  const c  = sprint?.campaign;
  const v  = sprint?.verdict;
  const activeChannels = activeChannelsFor(sprint);
  const selectedAngle = selectedAngleFor(sprint);
  const layout = buildLayout(activeChannels.length);

  const raw: Node[] = [
    // Accounts — LaunchLense managed platforms (always ready, no user OAuth needed)
    { id: 'accounts', type: 'accounts', position: { x: X.accounts, y: layout.standardTop },
      data: { connectedCount: activeChannels.length, managed: true, stage: sprintStageFor('accounts', s, sprint) } },

    // Genome
    { id: 'genome', type: 'genome', position: { x: X.genome, y: layout.standardTop },
      data: { composite: g?.composite, signal: g?.signal, stage: sprintStageFor('genome', s, sprint) } },

    ...(includeBudget
      ? [{
          id: 'budget',
          type: 'budget',
          position: { x: X.budget, y: layout.standardTop },
          data: { stage: sprintStageFor('budget', s, sprint) },
        }]
      : []),

    // Angles
    { id: 'angles', type: 'angles', position: { x: X.angles, y: layout.standardTop },
      data: { angleCount: selectedAngle ? 1 : a?.angles?.length, archetypes: selectedAngle ? [selectedAngle.archetype] : a?.angles?.map((ang) => ang.archetype), stage: sprintStageFor('angles', s, sprint) } },

    // Channel creative previews for the selected angle only
    ...activeChannels.map((ch, i) => ({
      id: `creative-${ch}`, type: 'creative', position: { x: X.creative, y: layout.laneTop(i, NODE_SIZE.creative.height) },
      data: creativeDataFor(ch, sprint, creativeDrafts),
    })),

    // Landing pages
    { id: 'landing', type: 'landing', position: { x: X.landing, y: layout.standardTop },
      data: { ...landingDraftFor(sprint, landingDraft), stage: sprintStageFor('landing', s, sprint) } },

    // Campaign per selected channel
    ...activeChannels.map((ch, i) => ({
      id: `campaign-${ch}`, type: 'campaign', position: { x: X.campaign, y: layout.laneTop(i) },
      data: {
        channel: ch,
        ctr: c?.[ch]?.angle_metrics?.length
          ? c[ch].angle_metrics.reduce((s, a) => s + a.clicks, 0) /
            Math.max(1, c[ch].angle_metrics.reduce((s, a) => s + a.impressions, 0))
          : undefined,
        spendCents: c?.[ch]?.spent_cents,
        stage: sprintStageFor(`campaign-${ch}`, s, sprint),
      },
    })),

    // Verdict
    { id: 'verdict', type: 'verdict', position: { x: X.verdict, y: layout.standardTop },
      data: { verdict: v?.verdict, confidence: v?.confidence, stage: sprintStageFor('verdict', s, sprint) } },

    // Report
    { id: 'report', type: 'report', position: { x: X.report, y: layout.standardTop },
      data: { ready: !!sprint?.report?.pdf_url, stage: sprintStageFor('report', s, sprint) } },

    // Integration nodes — float independently below the workflow, no edges
    ...((): Node[] => {
      const i = sprint?.integrations ?? {};
      const slots = [
        i.canvas_sheet    && { id: 'spreadsheet', type: 'spreadsheet', data: { validCount: sprint?.post_sprint?.spreadsheet?.validContacts, stage: sprintStageFor('spreadsheet', s, sprint) } },
        i.canvas_outreach && { id: 'outreach',    type: 'outreach',    data: { sent: sprint?.post_sprint?.outreach?.totalSent, stage: sprintStageFor('outreach', s, sprint) } },
        i.canvas_slack    && { id: 'slack',        type: 'slack',       data: { posted: sprint?.post_sprint?.slack?.posted, stage: sprintStageFor('slack', s, sprint) } },
      ].filter(Boolean) as { id: string; type: string; data: Record<string, unknown> }[];

      // Position below the main workflow row, centred on the canvas
      const floatY = layout.standardTop + NODE_SIZE.standard.height + 200;
      const nodeW = NODE_SIZE.standard.width;
      const gap = 64;
      const totalW = slots.length * nodeW + (slots.length - 1) * gap;
      // Anchor centre at the middle of the main workflow
      const workflowCentreX = X.accounts + (X.report + nodeW - X.accounts) / 2;
      const startX = workflowCentreX - totalW / 2;

      return slots.map((slot, idx) => ({
        ...slot,
        position: { x: startX + idx * (nodeW + gap), y: floatY },
      }));
    })(),

  ];

  if (canvasWorkflowLogEnabled()) {
    const integ = sprint?.integrations;
    console.groupCollapsed(`${LOG_PREFIX} buildNodes · sprint=${sprint?.sprint_id ?? '—'} · state=${String(s)}`);
    console.log('workflow.head', {
      activeChannels,
      angleCount: a?.angles?.length ?? 0,
      hasGenome: Boolean(g),
      hasLanding: Boolean(sprint?.landing),
      hasCampaign: Boolean(c),
      hasVerdict: Boolean(v),
    });
    console.log('integrations.flags', {
      canvas_sheet: integ?.canvas_sheet,
      canvas_outreach: integ?.canvas_outreach,
      canvas_slack: integ?.canvas_slack,
    });
    const discoveryRows = raw.map((n) => {
      const d = nodeDiscovery(n.id, sprint);
      return {
        nodeId: n.id,
        type: n.type,
        visible: d.visible,
        reason: d.reason,
        uiStage: sprintStageFor(n.id, s, sprint),
      };
    });
    console.table(discoveryRows);
    const hidden = discoveryRows.filter((row) => !row.visible);
    if (hidden.length) console.log(`${LOG_PREFIX} hidden (${hidden.length})`, hidden);
    const visibleCount = raw.filter((node) => isNodeDiscovered(node.id, sprint)).length;
    console.log(`${LOG_PREFIX} summary`, {
      candidateCount: raw.length,
      visibleCount,
      spreadsheetInCandidates: raw.some((n) => n.id === 'spreadsheet'),
    });
    console.groupEnd();
  }

  return resolveNodeOverlaps(raw.filter((node) => isNodeDiscovered(node.id, sprint)));
}

function buildEdges(
  sprint: SprintRecord | null,
  visibleNodeIds: Set<string> | undefined,
  insertBudget: boolean,
): Edge[] {
  const s = sprint?.state;
  const activeChannels = activeChannelsFor(sprint);

  // v9 managed path: genome connects directly to budget (if payment gate) or straight to angles
  const genomeForward: Edge[] = insertBudget
    ? [{
        id: 'e-genome-budget',
        type: 'pipeline' as const,
        source: 'genome',
        target: 'budget',
        data: { state: edgeStageFor('e-genome-budget', s, sprint) },
      }]
    : [{
        id: 'e-genome-angles',
        type: 'pipeline' as const,
        source: 'genome',
        target: 'angles',
        data: { state: edgeStageFor('e-genome-angles', s, sprint) },
      }];

  const budgetBridge: Edge[] = insertBudget
    ? [{
        id: 'e-budget-angles',
        type: 'pipeline' as const,
        source: 'budget',
        target: 'angles',
        data: { state: edgeStageFor('e-budget-angles', s, sprint) },
      }]
    : [];

  const edges: Edge[] = [
    { id: 'e-accounts-genome', type: 'pipeline', source: 'accounts', target: 'genome', data: { state: edgeStageFor('e-accounts-genome', s, sprint) } },
    ...genomeForward,
    ...budgetBridge,
    ...activeChannels.map((ch) => ({
      id: `e-angles-creative-${ch}`, type: 'pipeline', source: 'angles', target: `creative-${ch}`,
      data: { state: channelEdgeState(`e-angles-creative-${ch}`, ch, sprint, 'pending') },
    })),
    ...activeChannels.map((ch) => ({
      id: `e-creative-${ch}-campaign-${ch}`, type: 'pipeline', source: `creative-${ch}`, target: `campaign-${ch}`,
      data: { state: channelEdgeState(`e-creative-${ch}-campaign-${ch}`, ch, sprint, 'pending') },
    })),
    ...activeChannels.map((ch) => ({
      id: `e-campaign-${ch}-verdict`, type: 'pipeline', source: `campaign-${ch}`, target: 'verdict',
      data: { state: channelEdgeState(`e-campaign-${ch}-verdict`, ch, sprint, 'pending') },
    })),
    { id: 'e-verdict-landing', type: 'pipeline', source: 'verdict', target: 'landing', data: { state: edgeStageFor('e-verdict-landing', s, sprint) } },
    { id: 'e-verdict-report', type: 'pipeline', source: 'verdict', target: 'report', data: { state: edgeStageFor('e-verdict-report', s, sprint) } },
  ];
  const filtered = visibleNodeIds
    ? edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
    : edges;

  if (canvasWorkflowLogEnabled()) {
    console.groupCollapsed(
      `${LOG_PREFIX} buildEdges · sprint=${sprint?.sprint_id ?? '—'} · state=${String(s)} · visibleNodeCount=${visibleNodeIds?.size ?? 'all'}`,
    );
    if (visibleNodeIds) {
      const dropped = edges.filter((e) => !visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target));
      if (dropped.length) {
        console.log(`${LOG_PREFIX} edges dropped (missing endpoint in visible set)`, dropped.length);
        console.table(
          dropped.map((e) => ({
            edgeId: e.id,
            source: e.source,
            target: e.target,
            sourceIn: visibleNodeIds.has(e.source),
            targetIn: visibleNodeIds.has(e.target),
          })),
        );
      }
    }
    console.table(filtered.map((e) => ({ edgeId: e.id, edgeState: (e.data as { state?: string })?.state })));
    console.groupEnd();
  }

  return filtered;
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
    integrations: raw.integrations ?? undefined,
    post_sprint: raw.post_sprint ?? undefined,
    created_at: raw.created_at ?? new Date().toISOString(),
    updated_at: raw.updated_at ?? raw.created_at ?? new Date().toISOString(),
  } as SprintRecord;
}


async function readApiError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => '');
  if (!text) return fallback;
  try {
    const json = JSON.parse(text) as { error?: string };
    return json.error ?? fallback;
  } catch {
    return text.slice(0, 180) || fallback;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── New Sprint Modal ─────────────────────────────────────────────────────────
function NewSprintModal({ onClose, onCreated }: { onClose: () => void; onCreated: (sprint: SprintRecord) => void }) {
  const [idea, setIdea] = useState('');
  const [channels, setChannels] = useState<Platform[]>([...CHANNELS]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleChannel = (channel: Platform) => {
    setChannels((prev) => {
      if (prev.includes(channel)) {
        return prev.length === 1 ? prev : prev.filter((item) => item !== channel);
      }
      return [...prev, channel];
    });
  };

  const handleSubmit = async () => {
    if (!idea.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/sprint', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: idea.trim(), channels }),
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
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8C8880', marginBottom: 8 }}>Channels</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {CHANNELS.map((channel) => {
              const selected = channels.includes(channel);
              return (
                <button
                  key={channel}
                  type="button"
                  onClick={() => toggleChannel(channel)}
                  style={{
                    height: 38,
                    border: `1px solid ${selected ? '#111110' : '#E8E4DC'}`,
                    background: selected ? '#F3F0EB' : '#FFFFFF',
                    borderRadius: 10,
                    color: '#111110',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: selected ? 700 : 500,
                    textTransform: 'capitalize',
                  }}
                >
                  {channel}
                </button>
              );
            })}
          </div>
        </div>
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
  const running = ['GENOME_RUNNING','PAYMENT_PENDING','ANGLES_RUNNING','LANDING_RUNNING','CAMPAIGN_RUNNING','CAMPAIGN_MONITORING','VERDICT_GENERATING'].includes(state);
  const label: Record<string, string> = {
    GENOME_RUNNING: 'GenomeAgent running…', GENOME_DONE: 'Genome complete',
    PAYMENT_PENDING: 'Awaiting Stripe payment…',
    ANGLES_RUNNING: 'AngleAgent running…', ANGLES_DONE: 'Angles generated',
    LANDING_RUNNING: 'Landing page generating…', LANDING_DONE: 'Landing page ready',
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

function AgentRunPanel({ state }: { state?: SprintState }) {
  if (!state) return null;
  // v9: 5-step progress bar — Healthgate removed from managed-account path
  const steps: { state: SprintState; label: string }[] = [
    { state: 'GENOME_RUNNING', label: 'Genome' },
    { state: 'ANGLES_RUNNING', label: 'Angles' },
    { state: 'LANDING_RUNNING', label: 'Landing' },
    { state: 'CAMPAIGN_RUNNING', label: 'Campaign' },
    { state: 'VERDICT_GENERATING', label: 'Verdict' },
  ];
  const active = steps.find((step) => step.state === state);
  if (!active) return null;

  return (
    <div style={{ width: 320, background: '#111110', color: '#FFFFFF', border: '1px solid #242424', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
      <p style={{ margin: '0 0 4px', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8C8880' }}>
        Agent running
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{active.label}Agent</p>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFFFFF' }} className="animate-pulse" />
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
        {steps.map((step) => {
          const isActive = step.state === state;
          return (
            <div
              key={step.state}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 99,
                background: isActive ? '#FFFFFF' : '#2E2E2E',
              }}
            />
          );
        })}
      </div>
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
  const { fitView } = useReactFlow();
  const nodeTypes = useMemo(() => NODE_TYPES, []);
  const edgeTypes = useMemo(() => EDGE_TYPES, []);

  const [sprints, setSprints] = useState<{ id: string; name: string; status: string }[]>([]);
  const [activeSprint, setActiveSprint] = useState<string | null>(initialSprint ?? null);
  const [sprintData, setSprintData] = useState<SprintRecord | null>(null);
  const [showNew, setShowNew] = useState(openNew ?? false);
  const [activePanel, setActivePanel] = useState<PanelId>((initialPanel as PanelId) ?? null);
  const [panelChannel, setPanelChannel] = useState<string | undefined>(undefined);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [creativeDrafts, setCreativeDrafts] = useState<CreativeDrafts>({});
  const [landingDraft, setLandingDraft] = useState<LandingDraft | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sprintFromQuery = searchParams.get('sprint');

  // Persists the last-loaded sprint id so OAuth redirects that lose the URL
  // (e.g. invalid_state → /canvas?panel=integrations) can restore it.
  const LAST_SPRINT_KEY = 'launchlense_last_sprint_id';
  const panelFromQuery = searchParams.get('panel');

  // Keep the active sprint aligned with the URL (path, ?sprint=, or manual host fix after OAuth).
  // Does not clear workflow data in the DB — only drives which sprint we fetch into the canvas.
  useEffect(() => {
    const normalizedPath = pathname.replace(/\/$/, '') || '/';
    const m = pathname.match(/^\/canvas\/([^/?#]+)/);
    let id: string | null = null;
    if (m?.[1] && m[1] !== 'new') {
      try {
        id = decodeURIComponent(m[1]);
      } catch {
        id = m[1];
      }
    }
    if (!id && sprintFromQuery?.trim()) id = sprintFromQuery.trim();

    // ── OAuth fallback: restore last sprint when URL has no sprint id ────────
    // Happens when Google OAuth returns invalid_state → /canvas?panel=integrations
    if (!id && normalizedPath === '/canvas') {
      const hasOAuthReturn = searchParams.get('google_connected') || searchParams.get('google_error') || searchParams.get('panel') === 'integrations';
      if (hasOAuthReturn) {
        try {
          const saved = localStorage.getItem(LAST_SPRINT_KEY);
          if (saved) {
            id = saved;
            // Restore the sprint ID into the URL so refreshes also work
            window.history.replaceState(null, '', `/canvas/${encodeURIComponent(saved)}?${searchParams.toString()}`);
            if (canvasWorkflowLogEnabled()) {
              console.log(`${LOG_PREFIX} urlSync · restored sprint from localStorage after OAuth return`, { sprintId: id });
            }
          }
        } catch { /* localStorage unavailable */ }
      }
    }

    if (!id && normalizedPath === '/canvas') {
      if (canvasWorkflowLogEnabled()) {
        console.log(`${LOG_PREFIX} urlSync · cleared canvas (no sprint in path/query)`);
      }
      setActiveSprint(null);
      setSprintData(null);
      return;
    }

    if (id) {
      if (canvasWorkflowLogEnabled()) {
        console.log(`${LOG_PREFIX} urlSync · active sprint from URL`, { sprintId: id, pathname, sprintFromQuery });
      }
      setActiveSprint((prev) => (prev === id ? prev : id));
    }
  }, [pathname, sprintFromQuery, searchParams]);

  useEffect(() => {
    if (panelFromQuery) setActivePanel(panelFromQuery as PanelId);
  }, [panelFromQuery]);

  const baseNodes = useMemo(() => {
    const built = buildNodes(sprintData, creativeDrafts, landingDraft);
    return built.map((node) => {
      const position = nodePositions[node.id];
      return position && !isWorkflowAutoLayoutNode(node.id) ? { ...node, position } : node;
    });
  }, [sprintData, creativeDrafts, landingDraft, nodePositions]);
  const [nodes, setNodes] = useState<Node[]>(() => baseNodes);

  const visibleNodeIds = useMemo(() => new Set(baseNodes.map((node) => node.id)), [baseNodes]);
  const edges = useMemo(
    () => buildEdges(sprintData, visibleNodeIds, stripePaymentGateFromEnv()),
    [sprintData, visibleNodeIds],
  );

  useEffect(() => {
    setNodes((current) => mergeCanvasNodes(current, baseNodes));
  }, [baseNodes]);

  // Re-fit only when the visible node count changes (new nodes discovered).
  // Use two rAF ticks so React Flow has applied layout before we read bounding boxes.
  useEffect(() => {
    let frame2 = 0;
    const frame1 = window.requestAnimationFrame(() => {
      frame2 = window.requestAnimationFrame(() => {
        void fitView({ padding: 0.22, maxZoom: 1.8, duration: 320 });
      });
    });
    return () => {
      window.cancelAnimationFrame(frame1);
      window.cancelAnimationFrame(frame2);
    };
  }, [baseNodes.length, fitView]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => {
      const meaningful = meaningfulNodeChanges(changes, current);
      if (!meaningful.length) return current;
      return applyNodeChanges(meaningful, current);
    });
    setNodePositions((current) => {
      let next = current;

      for (const change of changes) {
        if (change.type !== 'position' || !change.position || change.dragging) continue;
        if (isWorkflowAutoLayoutNode(change.id)) continue;
        const previous = current[change.id];
        if (previous?.x === change.position.x && previous?.y === change.position.y) continue;

        if (next === current) next = { ...current };
        next[change.id] = change.position;
      }

      return next;
    });
  }, []);

  // ── Load sprint list (populate selector only — never auto-selects) ────────
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
          // ⚑ Never auto-select — the URL owns which sprint is active.
          // /canvas stays empty; /canvas/[id] loads via initialSprint prop.
        }
      } catch {}
    }
    void loadSprints();
  }, []);

  // ── Load sprint detail ───────────────────────────────────────────────────
  const loadSprintDetail = useCallback(async (id: string) => {
    if (canvasWorkflowLogEnabled()) {
      console.log(`${LOG_PREFIX} loadSprintDetail · request`, { sprintId: id });
    }
    try {
      let data: SprintRecord | null = null;
      let loadSource: 'api/sprint' | 'api/tests' | 'none' = 'none';
      const res = await fetch(`/api/sprint/${id}`);
      if (res.ok) {
        loadSource = 'api/sprint';
        const json = await res.json();
        data = normalizeSprint(json.sprint ?? json);
      } else {
        const res2 = await fetch(`/api/tests/${id}/metrics`);
        if (res2.ok) {
          loadSource = 'api/tests';
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
      if (canvasWorkflowLogEnabled()) {
        console.log(`${LOG_PREFIX} loadSprintDetail · response`, {
          sprintId: id,
          loadSource,
          state: data?.state,
          hasAngles: Boolean(data?.angles),
          integrationsCanvasSheet: data?.integrations?.canvas_sheet,
        });
      }
      setSprintData(data);
      // Persist so OAuth redirects back to /canvas (without sprint id) can recover
      if (data) {
        try { localStorage.setItem(LAST_SPRINT_KEY, id); } catch { /* ok */ }
      }
      return data;
    } catch (e) {
      if (canvasWorkflowLogEnabled()) {
        console.warn(`${LOG_PREFIX} loadSprintDetail · error`, { sprintId: id, error: e });
      }
      return null;
    }
  }, []);

  useEffect(() => {
    if (activeSprint) loadSprintDetail(activeSprint);
  }, [activeSprint, loadSprintDetail]);

  const paymentReturn = searchParams.get('payment');
  useEffect(() => {
    if (!paymentReturn || !activeSprint) return;

    // Clean the URL immediately so a refresh doesn't re-trigger
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      window.history.replaceState(null, '', url.pathname + (url.search ? url.search : ''));
    }

    captureEvent('canvas_payment_return', { sprint_id: activeSprint, payment: paymentReturn });

    if (paymentReturn === 'success') {
      // Attempt to advance the sprint via our fallback endpoint.
      // This confirms payment directly with Stripe so the sprint progresses
      // even if the webhook was slow, duplicated, or had a transient failure.
      (async () => {
        try {
          const res = await fetch(`/api/sprint/${encodeURIComponent(activeSprint)}/advance-after-payment`, {
            method: 'POST',
          });
          const json = await res.json() as { state?: string; advanced?: boolean };
          if (json.advanced) {
            await loadSprintDetail(activeSprint);
          } else {
            // Webhook may have already advanced it — reload to sync
            await loadSprintDetail(activeSprint);
          }
        } catch {
          // Non-fatal — Realtime / polling will catch the state change
          void loadSprintDetail(activeSprint);
        }
      })();
    } else {
      void loadSprintDetail(activeSprint);
    }
  }, [paymentReturn, activeSprint, loadSprintDetail]);

  useEffect(() => {
    setCreativeDrafts({});
    setLandingDraft(null);
  }, [activeSprint]);

  // ── Supabase Realtime — primary live update path ──────────────────────────
  // When the sprint row is updated server-side (any agent write), we get the
  // full new row via Postgres changes and re-normalise it directly into state.
  // No round-trip fetch required. `isLive` drives whether we also keep a
  // slower polling fallback running.
  const { isLive: realtimeLive } = useSprintRealtime(
    activeSprint,
    useCallback(
      (raw) => {
        const normalized = normalizeSprint(raw as RawSprintRecord);
        if (!normalized) return;
        setSprintData((prev) => {
          if (!prev) return normalized;
          // Never regress state from an optimistic local advance
          const order: SprintState[] = [
            'IDLE', 'GENOME_RUNNING', 'GENOME_DONE',
            'HEALTHGATE_RUNNING', 'HEALTHGATE_DONE',
            'PAYMENT_PENDING',
            'ANGLES_RUNNING', 'ANGLES_DONE',
            'LANDING_RUNNING', 'LANDING_DONE',
            'CAMPAIGN_RUNNING', 'CAMPAIGN_MONITORING',
            'VERDICT_GENERATING', 'COMPLETE',
          ];
          const prevIdx = order.indexOf(prev.state);
          const nextIdx = order.indexOf(normalized.state);
          const state = prevIdx > nextIdx ? prev.state : normalized.state;
          return { ...normalized, state };
        });
      },
      [],
    ),
  );

  // ── Auto-advance pipeline on Realtime state transitions ──────────────────
  // Each /run call executes one stage. When Realtime signals a transition to
  // GENOME_DONE or HEALTHGATE_DONE, we auto-call /run again for the next stage.
  // This keeps each function call under 10s (Vercel Hobby compatible).
  const prevStateRef = useRef<SprintState | undefined>(undefined);
  useEffect(() => {
    const state = sprintData?.state;
    const id = sprintData?.sprint_id;
    if (!state || !id || state === prevStateRef.current) return;
    prevStateRef.current = state;

    // Update active panel to match server state
    if (state === 'GENOME_RUNNING')     setActivePanel('genome');
    if (state === 'HEALTHGATE_RUNNING') setActivePanel('genome');
    if (state === 'ANGLES_RUNNING')     setActivePanel('angles');
    if (state === 'PAYMENT_PENDING')    { setActivePanel('budget'); setPipelineRunning(false); }
    if (state === 'ANGLES_DONE') {
      setActivePanel('angles');
      setPanelChannel(sprintData?.active_channels?.[0] ?? 'meta');
      setPipelineRunning(false);
    }
    if (state === 'BLOCKED')  setPipelineRunning(false);
    if (state === 'COMPLETE') setPipelineRunning(false);

    // Auto-continue: trigger next stage when intermediate states land
    if (state === 'GENOME_DONE' || state === 'HEALTHGATE_DONE') {
      fetch(`/api/sprint/${id}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .catch((err) => console.warn('[canvas] auto-continue /run failed:', err));
    }
  }, [sprintData?.state, sprintData?.sprint_id, sprintData?.active_channels]);

  // ── Polling fallback (only when Realtime is not subscribed) ──────────────
  // Keeps the canvas alive during Vercel cold starts or Supabase Realtime
  // connectivity gaps. Once Realtime takes over this interval does nothing
  // because `realtimeLive` becomes true.
  useEffect(() => {
    if (!activeSprint) return;
    if (realtimeLive) return; // Realtime is active — no need to poll
    const running =
      sprintData?.state &&
      ['GENOME_RUNNING','PAYMENT_PENDING','ANGLES_RUNNING','LANDING_RUNNING','CAMPAIGN_RUNNING','CAMPAIGN_MONITORING','VERDICT_GENERATING'].includes(
        sprintData.state,
      );
    if (!running) return;
    const interval = setInterval(() => loadSprintDetail(activeSprint), 8000);
    return () => clearInterval(interval);
  }, [activeSprint, sprintData?.state, loadSprintDetail, realtimeLive]);

  // ── Node click handler ───────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    event.stopPropagation();
    const id = node.id;
    if (id === 'accounts')   { setActivePanel('accounts');   setPanelChannel(undefined); return; }
    if (id === 'genome')     { setActivePanel('genome');     setPanelChannel(undefined); return; }
    if (id === 'budget') {
      setActivePanel('budget');
      setPanelChannel(undefined);
      captureEvent('canvas_node_clicked', { sprint_id: sprintData?.sprint_id, node_id: id, node_type: 'budget', node_status: sprintData?.state });
      return;
    }
    if (id === 'angles')     { setActivePanel('angles');     setPanelChannel(undefined); return; }
    if (id.startsWith('creative-')) {
      setActivePanel('creative');
      setPanelChannel(id.replace('creative-', ''));
      return;
    }
    if (id === 'landing')    { setActivePanel('landing');    setPanelChannel(undefined); return; }
    if (id.startsWith('campaign-')) {
      setActivePanel('campaign');
      setPanelChannel(id.replace('campaign-', ''));
      return;
    }
    if (id === 'verdict')    { setActivePanel('verdict');    setPanelChannel(undefined); return; }
    if (id === 'report')     { setActivePanel('report');     setPanelChannel(undefined); return; }
    if (id === 'spreadsheet') {
      setActivePanel('integrations_sheet');
      setPanelChannel(undefined);
      return;
    }
    if (id === 'outreach') {
      setActivePanel('integrations_outreach');
      setPanelChannel(undefined);
      return;
    }
    if (id === 'slack') {
      setActivePanel('integrations_slack');
      setPanelChannel(undefined);
      return;
    }
    if (id === 'benchmarks') { setActivePanel('benchmarks'); setPanelChannel(undefined); return; }
    if (id === 'settings')   { setActivePanel('settings');   setPanelChannel(undefined); return; }
  }, [sprintData?.sprint_id, sprintData?.state]);

  const runSprintPipeline = useCallback(async (id: string, options: { overrideStop?: boolean; continueAfterAngles?: boolean } = {}) => {
    setPipelineError(null);
    setPipelineRunning(true);
    try {
      let current = await loadSprintDetail(id);
      if (!current) throw new Error('Sprint could not be loaded');

      // Handle override-stop for BLOCKED sprints
      if (current.state === 'BLOCKED') {
        if (!options.overrideStop || !current.genome) {
          throw new Error(current.blocked_reason ?? 'Sprint is blocked');
        }
        const res = await fetch(`/api/sprint/${id}/override-stop`, { method: 'POST' });
        if (!res.ok) throw new Error(await readApiError(res, 'Override failed'));
        current = await loadSprintDetail(id);
        if (!current) throw new Error('Sprint could not be loaded after override');
      }

      // Handle payment gate — cannot auto-advance
      if (current.state === 'PAYMENT_PENDING') {
        setActivePanel('budget');
        const payRes = await fetch(`/api/sprint/${id}/payment-status`);
        const pay = payRes.ok ? await payRes.json() : { completed: false };
        if (!pay.completed) {
          setPipelineError('Finish payment in Stripe, or wait for confirmation. This page polls automatically.');
          return;
        }
        current = await loadSprintDetail(id);
      }

      if (!current) throw new Error('Sprint could not be loaded');

      // Terminal display states — just navigate the UI panel
      if (current.state === 'ANGLES_DONE') {
        setActivePanel(options.continueAfterAngles ? 'creative' : 'angles');
        setPanelChannel(current.active_channels?.[0] ?? 'meta');
        return;
      }
      if (current.state === 'LANDING_RUNNING') { setActivePanel('landing'); return; }
      if (current.state === 'LANDING_DONE') {
        setActivePanel('campaign');
        setPipelineError('Landing page is deployed. Campaign launch is the next gated step.');
        return;
      }

      // ── Server-orchestrated pipeline ────────────────────────────────────
      // Single call to /run — server drives Genome → Healthgate → Angles.
      // Canvas observes state transitions via Supabase Realtime subscription.
      // The Realtime handler below (useSprintRealtime) updates sprintData & panels.
      if (['IDLE', 'GENOME_DONE', 'GENOME_RUNNING', 'HEALTHGATE_DONE', 'HEALTHGATE_RUNNING'].includes(current.state)) {
        setActivePanel('genome');
        const res = await fetch(`/api/sprint/${id}/run`, { method: 'POST' });
        if (res.status === 402) { setActivePanel('budget'); return; }
        if (res.status === 409) {
          // Already running or in terminal state — load latest
          current = await loadSprintDetail(id);
        } else if (!res.ok) {
          throw new Error(await readApiError(res, 'Pipeline start failed'));
        }
        // Realtime subscription drives the rest — no sequential polling needed
        return;
      }
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Sprint pipeline failed');
      await loadSprintDetail(id);
    } finally {
      setPipelineRunning(false);
    }
  }, [loadSprintDetail]);

  const runDemoAfterCreatives = useCallback(async (id: string) => {
    setPipelineError(null);
    setPipelineRunning(true);
    try {
      setActivePanel('campaign');
      setPanelChannel(undefined);
      setSprintData((prev) => prev && prev.sprint_id === id ? { ...prev, state: 'CAMPAIGN_RUNNING' } : prev);
      await wait(450);
      const res = await fetch(`/api/sprint/${id}/demo-complete`, { method: 'POST' });
      if (!res.ok) throw new Error(await readApiError(res, 'Demo workflow failed'));
      const json = await res.json() as { sprint?: RawSprintRecord };
      const updated = normalizeSprint(json.sprint ?? null);
      if (updated) setSprintData(updated);
      setActivePanel('campaign');
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Demo workflow failed');
      await loadSprintDetail(id);
    } finally {
      setPipelineRunning(false);
    }
  }, [loadSprintDetail]);

  const handleCreated = (sprint: SprintRecord) => {
    captureEvent('sprint_created', {
      sprint_id: sprint.sprint_id,
      idea_length_chars: sprint.idea?.length ?? 0,
      genome_enabled: true,
      channels_selected: sprint.active_channels,
    });
    setSprints((prev) => [{ id: sprint.sprint_id, name: sprint.idea, status: 'idle' }, ...prev]);
    setActiveSprint(sprint.sprint_id);
    setSprintData(sprint);
    setActivePanel('genome');
    setShowNew(false);
    try { localStorage.setItem(LAST_SPRINT_KEY, sprint.sprint_id); } catch { /* ok */ }
    // Push URL without triggering a Next.js navigation — keeps this component alive
    // so runSprintPipeline's setSprintData / setActivePanel calls still work.
    // On refresh the browser lands on /canvas/[id] which loads correctly.
    window.history.pushState(null, '', `/canvas/${encodeURIComponent(sprint.sprint_id)}`);
    void runSprintPipeline(sprint.sprint_id, { overrideStop: true });
  };

  const handleEditSetup = (sprintId: string) => {
    setActiveSprint(sprintId);
    window.history.pushState(null, '', `/canvas/${encodeURIComponent(sprintId)}`);
    setActivePanel('campaign');
    setPanelChannel(undefined);
  };

  const handleSprintPatched = useCallback((raw: unknown) => {
    const normalized = normalizeSprint(raw as RawSprintRecord);
    if (!normalized) return;
    setSprintData((prev) => {
      if (!prev) return normalized;
      // The pipeline makes optimistic state advances in memory before the DB
      // is updated. A PATCH for integrations/angles can return a DB row that
      // still has the old (lower) state. Always keep the further-along state.
      const order: SprintState[] = [
        'IDLE', 'GENOME_RUNNING', 'GENOME_DONE',
        'HEALTHGATE_RUNNING', 'HEALTHGATE_DONE',
        'PAYMENT_PENDING',
        'ANGLES_RUNNING', 'ANGLES_DONE',
        'LANDING_RUNNING', 'LANDING_DONE',
        'CAMPAIGN_RUNNING', 'CAMPAIGN_MONITORING',
        'VERDICT_GENERATING', 'COMPLETE',
      ];
      const prevIdx = order.indexOf(prev.state);
      const nextIdx = order.indexOf(normalized.state);
      const state = prevIdx > nextIdx ? prev.state : normalized.state;
      return { ...normalized, state };
    });
  }, []);

  const handleCreativeDraftChange = useCallback((draft: CreativeDraft) => {
    setCreativeDrafts((prev) => {
      const current = prev[draft.channel];
      if (
        current &&
        draftFingerprint(current) === draftFingerprint(draft)
      ) {
        return prev;
      }

      return { ...prev, [draft.channel]: draft };
    });
  }, []);

  const handleLandingDraftChange = useCallback((draft: LandingDraft) => {
    setLandingDraft((current) => {
      if (current && landingFingerprint(current) === landingFingerprint(draft)) return current;
      return draft;
    });
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#FAFAF8', position: 'relative', fontFamily: 'inherit' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onPaneClick={() => {
          setActivePanel(null);
        }}
        fitView
        fitViewOptions={{ padding: 0.22, maxZoom: 1.05 }}
        minZoom={0.3}
        maxZoom={1.7}
        nodesDraggable
        panOnScroll
        selectionOnDrag
        proOptions={{ hideAttribution: true }}
      >
        <Background id="lane-grid" variant={BackgroundVariant.Lines} gap={120} size={0.8} color="#F3F0EB" />
        <Background id="dot-grid" variant={BackgroundVariant.Dots} gap={20} size={1.25} color="#D8D2C7" />

        <Panel position="top-left" style={{ margin: 14 }}>
          <CanvasToolbar
            sprints={sprints}
            activeSprint={activeSprint}
            onSelect={(id) => {
              setActiveSprint(id);
              setActivePanel(null);
              const url = id ? `/canvas/${encodeURIComponent(id)}` : '/canvas';
              window.history.pushState(null, '', url);
            }}
            onNew={() => setShowNew(true)}
            onOpenPanel={(panel) => {
              setActivePanel(panel as PanelId);
              setPanelChannel(undefined);
            }}
          />
        </Panel>

        {activePanel && (
          <Panel position="top-right" style={{ margin: 14 }}>
            <NodePanel
              panel={activePanel}
              channel={panelChannel}
              sprint={sprintData}
              onClose={() => {
                setActivePanel(null);
              }}
              onEditSetup={handleEditSetup}
              onRunWorkflow={(id) => void runSprintPipeline(id, { overrideStop: true })}
              onContinueAfterAngles={() => {
                setActivePanel('creative');
                setPanelChannel(sprintData?.active_channels?.[0] ?? 'meta');
              }}
              onContinueAfterCreatives={(id) => void runDemoAfterCreatives(id)}
              creativeDraft={
                activePanel === 'creative' && panelChannel
                  ? creativeDrafts[panelChannel as Platform]
                  : undefined
              }
              onCreativeDraftChange={handleCreativeDraftChange}
              landingDraft={landingDraft}
              onLandingDraftChange={handleLandingDraftChange}
              onSprintPatched={handleSprintPatched}
              workflowRunning={pipelineRunning}
              embedded
            />
          </Panel>
        )}

        {sprintData?.state && (
          <Panel position="bottom-center" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StateLabel state={sprintData.state} />
              {realtimeLive && (
                <div
                  title="Live via Supabase Realtime"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 10px',
                    background: '#FFFFFF', border: '1px solid #E8E4DC',
                    borderRadius: 99, fontSize: '0.6875rem', fontWeight: 600, color: '#16A34A',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} className="animate-pulse" />
                  Live
                </div>
              )}
            </div>
          </Panel>
        )}

        {sprintData?.state && (
          <Panel position="bottom-right" style={{ margin: 16 }}>
            <AgentRunPanel state={sprintData.state} />
          </Panel>
        )}

        {pipelineError && (
          <Panel position="top-center" style={{ marginTop: 76 }}>
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
