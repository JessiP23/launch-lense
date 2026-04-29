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

const MARKERS: Record<EdgeState, string> = {
  pending: 'url(#ll-arrow-muted)',
  running: 'url(#ll-arrow-ink)',
  done: 'url(#ll-arrow-ink)',
  warn: 'url(#ll-arrow-muted)',
  blocked: 'url(#ll-arrow-stop)',
};

export function PipelineEdgeMarkers() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        {[
          ['ll-arrow-ink', '#111110', 1],
          ['ll-arrow-muted', '#8C8880', 0.9],
          ['ll-arrow-stop', '#DC2626', 1],
        ].map(([id, color, opacity]) => (
          <marker
            key={id}
            id={id as string}
            markerWidth="16"
            markerHeight="16"
            viewBox="-8 -8 16 16"
            refX="1"
            refY="0"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M -4 -4 L 2 0 L -4 4 Z"
              fill={color as string}
              opacity={opacity as number}
            />
          </marker>
        ))}
      </defs>
    </svg>
  );
}

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
        markerEnd={MARKERS[state]}
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
      {state === 'running' && (
        <circle r="3.2" fill={color}>
          <animateMotion dur="1.3s" repeatCount="indefinite" path={path} />
        </circle>
      )}
    </>
  );
}
