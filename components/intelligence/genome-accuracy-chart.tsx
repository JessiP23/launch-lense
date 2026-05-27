'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
import { motion } from 'framer-motion';
import { useState } from 'react';

export function GenomeAccuracyChart({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  // Sort sprints by created_at ascending for time series
  const sortedSprints = [...sprints].sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Calculate accuracy per sprint (1 = match, 0 = miss)
  const accuracyData = sortedSprints.map((sprint: any, index: number) => {
    const genomeSignal = sprint.genome?.signal;
    const verdict = sprint.verdict?.aggregate_verdict;
    let match = 0;
    if (genomeSignal && verdict) {
      const mappedSignal = genomeSignal === 'STOP' ? 'NO-GO' : genomeSignal;
      match = mappedSignal === verdict ? 1 : 0;
    }
    return {
      sprint: index + 1,
      match,
      verdict,
    };
  });

  // Calculate 7-sprint rolling average
  const rollingData = accuracyData.map((point: any, index: number) => {
    const window = accuracyData.slice(Math.max(0, index - 6), index + 1);
    const avg = window.reduce((sum: number, p: any) => sum + p.match, 0) / window.length;

    return {
      sprint: point.sprint,
      accuracy: (avg * 100).toFixed(1),
      verdict: point.verdict,
    };
  });

  if (isLoading || rollingData.length === 0) {
    return (
      <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          GENOME ACCURACY OVER TIME
        </div>
        <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
          No data yet
        </div>
      </div>
    );
  }

  const width = 600;
  const height = 250;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxSprint = Math.max(...rollingData.map((d) => d.sprint));
  const maxAccuracy = 100;

  const getX = (sprint: number) => padding.left + (sprint / maxSprint) * chartWidth;
  const getY = (accuracy: number) => padding.top + chartHeight - (accuracy / maxAccuracy) * chartHeight;

  // Generate path for area fill
  const areaPath = rollingData.map((d, i) => {
    const x = getX(d.sprint);
    const y = getY(parseFloat(d.accuracy));
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ') + ` L ${getX(rollingData[rollingData.length - 1].sprint)} ${padding.top + chartHeight} L ${getX(rollingData[0].sprint)} ${padding.top + chartHeight} Z`;

  // Generate path for line
  const linePath = rollingData.map((d, i) => {
    const x = getX(d.sprint);
    const y = getY(parseFloat(d.accuracy));
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');

  const baselineY = getY(50);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}
    >
      <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        GENOME ACCURACY OVER TIME
      </div>
      <div style={{ position: 'relative' }}>
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
          {/* Subtle horizontal grid lines */}
          {[0, 25, 50, 75, 100].map((value) => (
            <line
              key={value}
              x1={padding.left}
              y1={getY(value)}
              x2={width - padding.right}
              y2={getY(value)}
              stroke="var(--surface-border)"
              strokeWidth={1}
              strokeDasharray={value === 50 ? '4 4' : 'none'}
            />
          ))}

          {/* Baseline reference line */}
          <line
            x1={padding.left}
            y1={baselineY}
            x2={width - padding.right}
            y2={baselineY}
            stroke="var(--text-tertiary)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <text
            x={width - padding.right}
            y={baselineY - 8}
            fill="var(--text-tertiary)"
            fontSize="10"
            textAnchor="end"
            fontFamily="var(--font-mono)"
          >
            baseline
          </text>

          {/* Area fill with gradient */}
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#areaGradient)" />

          {/* Line */}
          <motion.path
            d={linePath}
            fill="none"
            stroke="var(--accent-blue)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />

          {/* Custom dots */}
          {rollingData.map((d, i) => (
            <g key={d.sprint}>
              <circle
                cx={getX(d.sprint)}
                cy={getY(parseFloat(d.accuracy))}
                r={4}
                fill="var(--surface-primary)"
                stroke="var(--accent-blue)"
                strokeWidth={2}
                onMouseEnter={() => setHoveredPoint(d)}
                onMouseLeave={() => setHoveredPoint(null)}
                style={{ cursor: 'pointer' }}
              />
            </g>
          ))}

          {/* X-axis labels */}
          {rollingData.filter((_, i) => i % Math.ceil(rollingData.length / 5) === 0).map((d) => (
            <text
              key={d.sprint}
              x={getX(d.sprint)}
              y={height - 10}
              fill="var(--text-tertiary)"
              fontSize="11"
              textAnchor="middle"
              fontFamily="var(--font-mono)"
            >
              {d.sprint}
            </text>
          ))}

          {/* Y-axis labels */}
          {[0, 25, 50, 75, 100].map((value) => (
            <text
              key={value}
              x={padding.left - 10}
              y={getY(value) + 4}
              fill="var(--text-tertiary)"
              fontSize="11"
              textAnchor="end"
              fontFamily="var(--font-mono)"
            >
              {value}%
            </text>
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              left: getX(hoveredPoint.sprint),
              top: getY(parseFloat(hoveredPoint.accuracy)) - 50,
              transform: 'translateX(-50%)',
              background: 'var(--surface-card)',
              border: '1px solid var(--surface-border)',
              padding: '8px 12px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div>Sprint #{hoveredPoint.sprint}</div>
            <div>Accuracy: {hoveredPoint.accuracy}%</div>
            <div>Verdict: {hoveredPoint.verdict || 'N/A'}</div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
