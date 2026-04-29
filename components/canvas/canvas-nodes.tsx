'use client';

import { memo, type ReactNode } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { motion } from 'framer-motion';

// ── PROOF design tokens ─────────────────────────────────────────────────────
const C = {
  ink: '#111110', muted: '#8C8880', border: '#E8E4DC',
  surface: '#FFFFFF', faint: '#F3F0EB',
  go: '#16A34A', warn: '#8C8880', stop: '#DC2626',
};

export type NodeStage = 'idle' | 'running' | 'done' | 'blocked' | 'warn';

function stageColor(s: NodeStage) {
  if (s === 'done')    return C.ink;
  if (s === 'running') return C.ink;
  if (s === 'blocked') return C.stop;
  if (s === 'warn')    return C.muted;
  return C.muted;
}

function stageBg(s: NodeStage) {
  if (s === 'done')    return C.surface;
  if (s === 'running') return C.faint;
  if (s === 'blocked') return '#FEF2F2';
  if (s === 'warn')    return C.faint;
  return C.surface;
}

function stageBorder(s: NodeStage) {
  if (s === 'done')    return C.ink;
  if (s === 'running') return C.ink;
  if (s === 'blocked') return C.stop;
  if (s === 'warn')    return C.muted;
  return C.border;
}

function stageLabel(s: NodeStage) {
  if (s === 'running') return 'Live';
  if (s === 'done') return 'Done';
  if (s === 'blocked') return 'Blocked';
  if (s === 'warn') return 'Review';
  return 'Queued';
}

// ── Shared card shell ───────────────────────────────────────────────────────
interface CardProps {
  label: string;
  metric?: string;
  metricLabel?: string;
  sublabel?: string;
  stage: NodeStage;
  hasLeft?: boolean;
  hasRight?: boolean;
  selected?: boolean;
  width?: number;
  height?: number;
  children?: ReactNode;
}

function NodeCard({
  label, metric, metricLabel, sublabel,
  stage, hasLeft = true, hasRight = true, selected = false, width = 192, height, children,
}: CardProps) {
  const border = stageBorder(stage);
  const isRunning = stage === 'running';
  const statusColor = stage === 'blocked' ? C.stop : stage === 'idle' ? C.muted : C.ink;
  const hiddenHandleStyle = {
    width: 10,
    height: 10,
    opacity: 0,
    border: 'none',
    background: 'transparent',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: selected ? 1.015 : 1,
      }}
      whileHover={{ y: -3, scale: 1.015 }}
      transition={{
        opacity: { duration: 0.22 },
        scale: { duration: 0.18 },
        y: { duration: 0.18 },
      }}
      style={{
        width,
        height,
        boxSizing: 'border-box',
        background: stageBg(stage),
        border: `${isRunning || selected ? 2 : 1.25}px solid ${selected ? C.ink : border}`,
        borderRadius: 16,
        padding: '11px 13px 12px',
        boxShadow: selected
          ? `0 0 0 3px ${C.ink}18, 0 1px 2px rgba(0,0,0,0.06)`
          : isRunning
          ? `0 0 0 5px ${C.ink}10, 0 1px 2px rgba(0,0,0,0.06)`
          : '0 1px 2px rgba(0,0,0,0.05)',
        cursor: 'grab',
        transition: 'box-shadow 0.2s ease, border-color 0.3s ease, transform 0.2s ease',
        position: 'relative',
        overflow: height ? 'hidden' : 'visible',
      }}
    >
      {isRunning && (
        <motion.div
          aria-hidden
          initial={{ scaleX: 0.2, opacity: 0.55 }}
          animate={{ scaleX: [0.2, 1, 0.2], opacity: [0.45, 0.95, 0.45] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            left: 14,
            right: 14,
            top: -2,
            height: 2,
            borderRadius: 999,
            background: C.ink,
            transformOrigin: 'center',
          }}
        />
      )}
      {hasLeft && (
        <Handle
          type="target" position={Position.Left}
          style={{
            ...hiddenHandleStyle,
            left: -6,
          }}
        />
      )}
      {hasRight && (
        <Handle
          type="source" position={Position.Right}
          style={{
            ...hiddenHandleStyle,
            right: -6,
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <p style={{ fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, margin: 0, lineHeight: 1.2 }}>
          {label}
        </p>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: 18,
          padding: '0 6px',
          border: `1px solid ${stage === 'idle' ? C.border : statusColor}`,
          borderRadius: 999,
          background: C.surface,
          color: statusColor,
          fontSize: '0.53125rem',
          fontWeight: 900,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          {isRunning && (
            <span
              style={{ width: 5, height: 5, borderRadius: '50%', background: C.ink, flexShrink: 0 }}
              className="animate-pulse"
            />
          )}
          {stageLabel(stage)}
        </span>
      </div>

      {metric != null && (
        <p style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.3rem', lineHeight: 1, letterSpacing: '-0.04em', color: stageColor(stage), margin: '0 0 3px' }}>
          {metric}
        </p>
      )}
      {metricLabel && (
        <p style={{ fontSize: '0.625rem', color: C.muted, margin: 0, fontWeight: 700 }}>{metricLabel}</p>
      )}
      {sublabel && !metric && (
        <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: stageColor(stage), margin: 0 }}>{sublabel}</p>
      )}
      {children}
      {stage !== 'idle' && stage !== 'warn' && (
        <motion.div
          aria-label={`${label} ${stageLabel(stage)}`}
          initial={{ scale: 0.72, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'absolute',
            right: 10,
            bottom: 10,
            width: 26,
            height: 26,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            border: `3px solid ${C.surface}`,
            background: stage === 'blocked' ? C.stop : stage === 'running' ? C.ink : C.go,
            color: '#FFF',
            boxShadow: '0 8px 20px rgba(17,17,16,0.16)',
            fontSize: '0.875rem',
            fontWeight: 950,
            lineHeight: 1,
          }}
        >
          {stage === 'running' ? (
            <motion.span
              aria-hidden
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.45)',
                borderTopColor: '#FFF',
              }}
            />
          ) : stage === 'blocked' ? '!' : '✓'}
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Node type exports ───────────────────────────────────────────────────────

export type AccountsNodeData  = { connectedCount: number; stage: NodeStage };
export type AccountsNodeType  = Node<AccountsNodeData, 'accounts'>;
export const AccountsNode = memo(({ data, selected }: NodeProps<AccountsNodeType>) => (
  <NodeCard label="Accounts" metric={`${data.connectedCount}/4`} metricLabel="platforms" stage={data.stage} hasLeft={false} selected={!!selected} />
));
AccountsNode.displayName = 'AccountsNode';

export type GenomeNodeData  = { signal?: string; composite?: number; stage: NodeStage };
export type GenomeNodeType  = Node<GenomeNodeData, 'genome'>;
export const GenomeNode = memo(({ data, selected }: NodeProps<GenomeNodeType>) => (
  <NodeCard
    label="Genome" stage={data.stage} selected={!!selected}
    metric={data.composite != null ? `${data.composite}` : data.stage === 'running' ? '…' : '—'}
    metricLabel={data.signal ?? 'composite score'}
  />
));
GenomeNode.displayName = 'GenomeNode';

export type HealthgateNodeData  = { channel: string; score?: number; status?: string; stage: NodeStage };
export type HealthgateNodeType  = Node<HealthgateNodeData, 'healthgate'>;
export const HealthgateNode = memo(({ data, selected }: NodeProps<HealthgateNodeType>) => (
  <NodeCard
    label={`HG · ${data.channel}`} stage={data.stage} selected={!!selected}
    metric={data.score != null ? `${data.score}` : data.stage === 'running' ? '…' : '—'}
    metricLabel={data.status ?? 'healthgate'}
  />
));
HealthgateNode.displayName = 'HealthgateNode';

export type AnglesNodeData  = { angleCount?: number; archetypes?: string[]; stage: NodeStage };
export type AnglesNodeType  = Node<AnglesNodeData, 'angles'>;
export const AnglesNode = memo(({ data, selected }: NodeProps<AnglesNodeType>) => (
  <NodeCard
    label="Angles" stage={data.stage} selected={!!selected}
    metric={data.angleCount != null ? `${data.angleCount}` : data.stage === 'running' ? '…' : '—'}
    metricLabel={data.archetypes?.slice(0, 2).join(' · ') ?? 'ad angles'}
  />
));
AnglesNode.displayName = 'AnglesNode';

export type CreativeNodeData = {
  channel?: string;
  selectedAngle?: string;
  stage: NodeStage;
  brandName?: string;
  image?: string | null;
  title?: string;
  body?: string;
  cta?: string;
};
export type CreativeNodeType = Node<CreativeNodeData, 'creative'>;
export const CreativeNode = memo(({ data, selected }: NodeProps<CreativeNodeType>) => (
  <NodeCard
    label={`Creative · ${data.channel ?? 'Channel'}`} stage={data.stage} selected={!!selected} width={248} height={352}
    metric={data.selectedAngle?.replace('angle_', '') ?? (data.stage === 'running' ? '…' : '—')}
    metricLabel={data.title ? 'live preview' : 'select angle'}
  >
    <CreativeNodePreview data={data} />
  </NodeCard>
));
CreativeNode.displayName = 'CreativeNode';

function CreativeNodePreview({ data }: { data: CreativeNodeData }) {
  if (!data.title && !data.body) {
    return (
      <div style={{ marginTop: 10, border: `1px dashed ${C.border}`, borderRadius: 10, padding: 10, color: C.muted, fontSize: '0.6875rem', lineHeight: 1.4 }}>
        Open this node to edit the selected angle creative.
      </div>
    );
  }

  if (data.channel === 'google') {
    return (
      <div style={{ marginTop: 10, border: `1px solid ${C.border}`, borderRadius: 10, background: C.surface, padding: 10 }}>
        <p style={{ margin: '0 0 3px', color: C.muted, fontSize: '0.5625rem' }}>Sponsored · {domainFor(data.brandName)}</p>
        <p style={{ margin: '0 0 4px', color: C.ink, fontSize: '0.75rem', fontWeight: 800, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{data.title}</p>
        <p style={{ margin: 0, color: C.muted, fontSize: '0.625rem', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{data.body}</p>
      </div>
    );
  }

  if (data.channel === 'tiktok') {
    return (
      <div style={{ margin: '10px auto 0', width: 116, height: 176, borderRadius: 14, overflow: 'hidden', background: C.ink, color: '#FFF', position: 'relative', border: `1px solid ${C.border}` }}>
        {data.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.72 }} />
        )}
        <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8 }}>
          <p style={{ margin: '0 0 4px', fontSize: '0.5625rem', color: '#FFFFFFB3' }}>@{handleFor(data.brandName)}</p>
          <p style={{ margin: '0 0 6px', fontSize: '0.6875rem', fontWeight: 900, lineHeight: 1.15, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{data.title}</p>
          <span style={{ display: 'inline-block', border: '1px solid #FFF', borderRadius: 999, padding: '3px 6px', fontSize: '0.5625rem', fontWeight: 800 }}>{data.cta}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', background: C.surface }}>
      <div style={{ padding: 8, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 7, alignItems: 'center' }}>
        <div style={{ width: 22, height: 22, borderRadius: data.channel === 'linkedin' ? 5 : '50%', border: `1px solid ${C.border}`, display: 'grid', placeItems: 'center', fontSize: '0.625rem', fontWeight: 800 }}>
          {(data.brandName ?? 'B')[0]}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.6875rem', fontWeight: 800 }}>{data.brandName ?? 'Brand'}</p>
          <p style={{ margin: 0, color: C.muted, fontSize: '0.5625rem' }}>Sponsored</p>
        </div>
      </div>
      {data.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.image} alt="" style={{ display: 'block', width: '100%', aspectRatio: '1.91 / 1', objectFit: 'cover', background: C.faint }} />
      ) : (
        <div style={{ width: '100%', aspectRatio: '1.91 / 1', display: 'grid', placeItems: 'center', background: C.faint, color: C.muted, fontSize: '0.625rem' }}>Image preview</div>
      )}
      <div style={{ padding: 8 }}>
        <p style={{ margin: '0 0 3px', fontSize: '0.75rem', fontWeight: 900, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{data.title}</p>
        <p style={{ margin: 0, color: C.muted, fontSize: '0.625rem', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{data.body}</p>
      </div>
    </div>
  );
}

function domainFor(brandName?: string) {
  return `${(brandName ?? 'brand').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'brand'}.com`;
}

function handleFor(brandName?: string) {
  return (brandName ?? 'brand').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'brand';
}

export type LandingNodeData = {
  pageCount?: number;
  stage: NodeStage;
  mode?: 'builder' | 'code';
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  cta?: string;
  proof?: string[];
  testimonial?: string;
  theme?: string;
  customHtml?: string;
  customCss?: string;
  url?: string | null;
};
export type LandingNodeType = Node<LandingNodeData, 'landing'>;
export const LandingNode = memo(({ data, selected }: NodeProps<LandingNodeType>) => (
  <NodeCard
    label="Landing Page" stage={data.stage} selected={!!selected} width={248} height={352}
    metric={data.pageCount != null ? `${data.pageCount}` : data.stage === 'running' ? '…' : '—'}
    metricLabel={data.url ? 'deployed page' : 'live page draft'}
  >
    <LandingNodePreview data={data} />
  </NodeCard>
));
LandingNode.displayName = 'LandingNode';

function LandingNodePreview({ data }: { data: LandingNodeData }) {
  if (data.mode === 'code') {
    const srcDoc = `<!doctype html><html><head><style>:root{--canvas:#FAFAF8;--surface:#FFFFFF;--border:#E8E4DC;--ink:#111110;--muted:#8C8880;--faint:#F3F0EB}*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font-family:Inter,system-ui,sans-serif;overflow:hidden}${data.customCss ?? ''}</style></head><body>${data.customHtml || '<main style="padding:24px"><p style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#8C8880;font-weight:800">Custom HTML/CSS</p><h1 style="font-size:42px;line-height:.95;letter-spacing:-.06em;margin:8px 0">Paste custom page</h1></main>'}</body></html>`;
    return (
      <div style={{ marginTop: 10, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', background: C.surface }}>
        <div style={{ height: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', borderBottom: `1px solid ${C.border}`, background: C.faint }}>
          <span style={{ fontSize: '0.5625rem', color: C.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>HTML/CSS</span>
          <span style={{ fontSize: '0.5625rem', color: C.muted }}>live</span>
        </div>
        <iframe
          title="Landing node custom preview"
          srcDoc={srcDoc}
          sandbox=""
          style={{ width: '100%', height: 238, border: 0, display: 'block', pointerEvents: 'none', transform: 'scale(0.82)', transformOrigin: 'top left', inlineSize: '122%' }}
        />
      </div>
    );
  }
  const proof = data.proof?.filter(Boolean).slice(0, 3) ?? [];
  const isEditorial = data.theme === 'editorial';
  return (
    <div style={{ marginTop: 10, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', background: C.surface }}>
      <div style={{ padding: 10, background: isEditorial ? C.ink : C.faint, color: isEditorial ? '#FFF' : C.ink }}>
        <p style={{ margin: '0 0 5px', color: isEditorial ? '#FFFFFF99' : C.muted, fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {data.eyebrow || 'Validation page'}
        </p>
        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.04em', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {data.headline || 'Open this node to build the page'}
        </p>
        <p style={{ margin: '7px 0 0', color: isEditorial ? '#FFFFFFB3' : C.muted, fontSize: '0.625rem', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {data.subheadline || 'Real-time landing preview appears here before deploy.'}
        </p>
      </div>
      <div style={{ padding: 10, display: 'grid', gap: 6 }}>
        {proof.length ? proof.map((item, index) => (
          <div key={`${item}-${index}`} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ width: 14, height: 14, borderRadius: 999, background: C.ink, color: '#FFF', display: 'grid', placeItems: 'center', fontSize: '0.5rem', fontWeight: 900, flexShrink: 0 }}>{index + 1}</span>
            <p style={{ margin: 0, color: C.ink, fontSize: '0.625rem', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item}</p>
          </div>
        )) : (
          <div style={{ height: 38, border: `1px dashed ${C.border}`, borderRadius: 8, display: 'grid', placeItems: 'center', color: C.muted, fontSize: '0.625rem' }}>Proof blocks</div>
        )}
        <div style={{ marginTop: 4, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: C.faint }}>
          <p style={{ margin: 0, fontSize: '0.625rem', color: C.muted, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{data.testimonial || 'Customer quote or demand signal'}</p>
        </div>
        <div style={{ marginTop: 3, height: 30, borderRadius: 999, background: C.ink, color: '#FFF', display: 'grid', placeItems: 'center', fontSize: '0.6875rem', fontWeight: 900 }}>
          {data.cta || 'Join Waitlist'}
        </div>
      </div>
    </div>
  );
}

export type CampaignNodeData  = { channel: string; ctr?: number; spendCents?: number; stage: NodeStage };
export type CampaignNodeType  = Node<CampaignNodeData, 'campaign'>;
export const CampaignNode = memo(({ data, selected }: NodeProps<CampaignNodeType>) => (
  <NodeCard
    label={`Cmp · ${data.channel}`} stage={data.stage} selected={!!selected}
    metric={data.ctr != null ? `${(data.ctr * 100).toFixed(2)}%` : data.stage === 'running' ? '…' : '—'}
    metricLabel={data.spendCents != null ? `$${(data.spendCents / 100).toFixed(0)} spent` : 'CTR'}
  />
));
CampaignNode.displayName = 'CampaignNode';

export type VerdictNodeData  = { verdict?: string; confidence?: number; stage: NodeStage };
export type VerdictNodeType  = Node<VerdictNodeData, 'verdict'>;
export const VerdictNode = memo(({ data, selected }: NodeProps<VerdictNodeType>) => (
  <NodeCard
    label="Verdict" stage={data.stage} selected={!!selected}
    metric={data.verdict ?? (data.stage === 'running' ? '…' : '—')}
    metricLabel={data.confidence != null ? `${data.confidence}% confidence` : 'aggregate'}
  />
));
VerdictNode.displayName = 'VerdictNode';

export type ReportNodeData  = { stage: NodeStage; ready?: boolean };
export type ReportNodeType  = Node<ReportNodeData, 'report'>;
export const ReportNode = memo(({ data, selected }: NodeProps<ReportNodeType>) => (
  <NodeCard
    label="Report" stage={data.stage} selected={!!selected}
    sublabel={data.ready ? 'Ready' : data.stage === 'running' ? 'Generating…' : 'Waiting'}
  />
));
ReportNode.displayName = 'ReportNode';

export type SpreadsheetNodeData = { validCount?: number; stage: NodeStage };
export type SpreadsheetNodeType = Node<SpreadsheetNodeData, 'spreadsheet'>;
export const SpreadsheetNode = memo(({ data, selected }: NodeProps<SpreadsheetNodeType>) => (
  <NodeCard
    label="Spreadsheet"
    stage={data.stage}
    selected={!!selected}
    metric={data.validCount != null ? `${data.validCount}` : '—'}
    metricLabel="valid contacts"
  />
));
SpreadsheetNode.displayName = 'SpreadsheetNode';

export type OutreachNodeData = { sent?: number; stage: NodeStage };
export type OutreachNodeType = Node<OutreachNodeData, 'outreach'>;
export const OutreachNode = memo(({ data, selected }: NodeProps<OutreachNodeType>) => (
  <NodeCard
    label="Outreach · Gmail"
    stage={data.stage}
    selected={!!selected}
    metric={data.sent != null ? `${data.sent}` : '—'}
    metricLabel="emails sent"
  />
));
OutreachNode.displayName = 'OutreachNode';

export type SlackNodeData = { posted?: boolean; stage: NodeStage };
export type SlackNodeType = Node<SlackNodeData, 'slack'>;
export const SlackNode = memo(({ data, selected }: NodeProps<SlackNodeType>) => (
  <NodeCard
    label="Slack"
    stage={data.stage}
    selected={!!selected}
    metric={data.posted ? 'Live' : '—'}
    metricLabel={data.posted ? 'posted' : 'summary'}
    hasRight={false}
  />
));
SlackNode.displayName = 'SlackNode';

export type BenchmarksNodeData  = { stage: NodeStage };
export type BenchmarksNodeType  = Node<BenchmarksNodeData, 'benchmarks'>;
export const BenchmarksNode = memo(({ data, selected }: NodeProps<BenchmarksNodeType>) => (
  <NodeCard label="Benchmarks" sublabel="6 verticals" stage={data.stage} selected={!!selected} hasLeft={false} hasRight={false} />
));
BenchmarksNode.displayName = 'BenchmarksNode';

export type SettingsNodeData  = { stage: NodeStage; configured?: boolean };
export type SettingsNodeType  = Node<SettingsNodeData, 'settings'>;
export const SettingsNode = memo(({ data, selected }: NodeProps<SettingsNodeType>) => (
  <NodeCard label="Settings" sublabel={data.configured ? 'Configured' : 'API Keys'} stage={data.stage} selected={!!selected} hasLeft={false} hasRight={false} />
));
SettingsNode.displayName = 'SettingsNode';
