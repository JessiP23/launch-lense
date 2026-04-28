'use client';

import { getBezierPath, BaseEdge, type EdgeProps } from '@xyflow/react';

export type EdgeState = 'pending' | 'running' | 'done' | 'warn' | 'blocked';

export interface PipelineEdgeData extends Record<string, unknown> {
  state?: EdgeState;
}

const COLORS: Record<EdgeState, string> = {
  pending: '#E8E4DC',
  running: '#111110',
  done:    '#059669',
  warn:    '#D97706',
  blocked: '#DC2626',
};

export function PipelineEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data,
}: EdgeProps) {
  const state = ((data as PipelineEdgeData)?.state ?? 'pending') as EdgeState;
  const color  = COLORS[state];
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <>
      {state === 'running' && (
        <style>{`
          @keyframes ll-dash-${id.replace(/[^a-z0-9]/gi, '')} {
            to { stroke-dashoffset: -20; }
          }
        `}</style>
      )}
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke:           color,
          strokeWidth:      1.5,
          strokeDasharray:  state === 'running' ? '6 4' : state === 'pending' ? '4 3' : undefined,
          animation:        state === 'running'
            ? `ll-dash-${id.replace(/[^a-z0-9]/gi, '')} 0.55s linear infinite`
            : 'none',
          opacity: state === 'pending' ? 0.35 : 1,
          transition: 'stroke 0.4s ease, opacity 0.4s ease',
        }}
      />
    </>
  );
}
