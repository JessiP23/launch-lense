'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';

// ── PROOF design tokens ─────────────────────────────────────────────────────
const C = {
  ink: '#111110', muted: '#8C8880', border: '#E8E4DC',
  surface: '#FFFFFF', faint: '#F3F0EB',
  go: '#059669', warn: '#D97706', stop: '#DC2626',
};

export type NodeStage = 'idle' | 'running' | 'done' | 'blocked' | 'warn';

function stageColor(s: NodeStage) {
  if (s === 'done')    return C.go;
  if (s === 'running') return C.ink;
  if (s === 'blocked') return C.stop;
  if (s === 'warn')    return C.warn;
  return C.muted;
}

function stageBg(s: NodeStage) {
  if (s === 'done')    return '#ECFDF5';
  if (s === 'running') return C.faint;
  if (s === 'blocked') return '#FEF2F2';
  if (s === 'warn')    return '#FFFBEB';
  return C.surface;
}

function stageBorder(s: NodeStage) {
  if (s === 'done')    return C.go;
  if (s === 'running') return C.ink;
  if (s === 'blocked') return C.stop;
  if (s === 'warn')    return C.warn;
  return C.border;
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
}

function NodeCard({
  label, metric, metricLabel, sublabel,
  stage, hasLeft = true, hasRight = true, selected = false,
}: CardProps) {
  const border = stageBorder(stage);
  return (
    <div
      style={{
        width: 168,
        background: stageBg(stage),
        border: `1.5px solid ${selected ? C.ink : border}`,
        borderRadius: 14,
        padding: '11px 13px 12px',
        boxShadow: selected
          ? `0 0 0 3px ${C.ink}20`
          : stage === 'running'
          ? `0 0 0 3px ${C.ink}12`
          : '0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s ease, border-color 0.3s ease',
        position: 'relative',
      }}
    >
      {hasLeft && (
        <Handle
          type="target" position={Position.Left}
          style={{ background: border, width: 7, height: 7, border: '1.5px solid white', left: -4 }}
        />
      )}
      {hasRight && (
        <Handle
          type="source" position={Position.Right}
          style={{ background: border, width: 7, height: 7, border: '1.5px solid white', right: -4 }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.muted, margin: 0 }}>
          {label}
        </p>
        {stage === 'running' && (
          <span
            style={{ width: 6, height: 6, borderRadius: '50%', background: C.ink, marginTop: 1, flexShrink: 0 }}
            className="animate-pulse"
          />
        )}
      </div>

      {metric != null && (
        <p style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.25rem', lineHeight: 1, color: stageColor(stage), margin: '0 0 3px' }}>
          {metric}
        </p>
      )}
      {metricLabel && (
        <p style={{ fontSize: '0.625rem', color: C.muted, margin: 0, fontWeight: 500 }}>{metricLabel}</p>
      )}
      {sublabel && !metric && (
        <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: stageColor(stage), margin: 0 }}>{sublabel}</p>
      )}
    </div>
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
    label="Report" stage={data.stage} selected={!!selected} hasRight={false}
    sublabel={data.ready ? 'Ready' : data.stage === 'running' ? 'Generating…' : 'Waiting'}
  />
));
ReportNode.displayName = 'ReportNode';

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
