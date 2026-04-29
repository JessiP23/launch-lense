'use client';

import { getBezierPath, BaseEdge, type EdgeProps } from '@xyflow/react';

export type EdgeState = 'pending' | 'running' | 'done' | 'warn' | 'blocked';

export interface PipelineEdgeData extends Record<string, unknown> {
  state?: EdgeState;
}

const COLORS: Record<EdgeState, string> = {
  pending: '#E8E4DC',
  running: '#111110',
  done:    '#111110',
  warn:    '#8C8880',
  blocked: '#DC2626',
};

const OPACITY: Record<EdgeState, number> = {
  pending: 0.42,
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
  const markerId = `ll-arrow-${cleanId}`;

  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerWidth="14"
          markerHeight="14"
          viewBox="-8 -8 16 16"
          refX="0"
          refY="0"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M -4 -4 L 2 0 L -4 4"
            fill="none"
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={state === 'pending' ? 0.35 : 1}
          />
        </marker>
      </defs>
      {state === 'running' && (
        <style>{`
          @keyframes ll-dash-${cleanId} {
            to { stroke-dashoffset: -24; }
          }
        `}</style>
      )}
      <BaseEdge
        id={`${id}-halo`}
        path={path}
        style={{
          stroke: '#FFFFFF',
          strokeWidth: state === 'running' ? 9 : 7,
          opacity: 0.84,
          strokeLinecap: 'round',
        }}
      />
      <BaseEdge
        id={id}
        path={path}
        markerEnd={`url(#${markerId})`}
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
        <>
          <circle r="3.2" fill={color}>
            <animateMotion dur="1.3s" repeatCount="indefinite" path={path} />
          </circle>
          <circle r="1.55" fill="#FFFFFF">
            <animateMotion dur="1.3s" repeatCount="indefinite" path={path} />
          </circle>
        </>
      )}
    </>
  );
}
