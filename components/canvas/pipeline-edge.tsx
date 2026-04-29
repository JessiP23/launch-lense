'use client';

import { getBezierPath, BaseEdge, type EdgeProps } from '@xyflow/react';

export type EdgeState = 'pending' | 'running' | 'done' | 'warn' | 'blocked';

export interface PipelineEdgeData extends Record<string, unknown> {
  state?: EdgeState;
}

const COLORS: Record<EdgeState, string> = {
  pending: '#C9C1B4',
  running: '#111110',
  done:    '#111110',
  warn:    '#8C8880',
  blocked: '#DC2626',
};

const OPACITY: Record<EdgeState, number> = {
  pending: 0.58,
  running: 1,
  done: 0.9,
  warn: 0.76,
  blocked: 0.92,
};

export function PipelineEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data,
}: EdgeProps) {
  const state = ((data as PipelineEdgeData)?.state ?? 'pending') as EdgeState;
  const color  = COLORS[state];
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const cleanId = id.replace(/[^a-z0-9]/gi, '');

  return (
    <>
      {state === 'running' && (
        <style>{`
          @keyframes ll-dash-${cleanId} {
            to { stroke-dashoffset: -24; }
          }
        `}</style>
      )}
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke:           color,
          strokeWidth:      state === 'running' ? 2.35 : state === 'done' ? 1.9 : 1.45,
          strokeLinecap:    'round',
          strokeDasharray:  state === 'running' ? '7 5' : state === 'pending' ? '2 7' : state === 'warn' ? '5 5' : undefined,
          animation:        state === 'running'
            ? `ll-dash-${cleanId} 0.64s linear infinite`
            : 'none',
          opacity: OPACITY[state],
          transition: 'stroke 0.4s ease, opacity 0.4s ease, stroke-width 0.25s ease',
        }}
      />
    </>
  );
}
