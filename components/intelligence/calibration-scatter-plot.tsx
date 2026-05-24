'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
import { useState } from 'react';
import { motion } from 'framer-motion';

const VERTICAL_KEYWORDS: Record<string, string[]> = {
  fintech: ['bank', 'finance', 'payment', 'crypto', 'trading', 'invest', 'loan', 'credit', 'insurance'],
  health: ['health', 'medical', 'doctor', 'wellness', 'fitness', 'therapy', 'pharma', 'patient', 'mental'],
  saas: ['software', 'platform', 'tool', 'app', 'dashboard', 'analytics', 'automation', 'api', 'workflow'],
  ecommerce: ['shop', 'store', 'market', 'sell', 'buy', 'retail', 'commerce', 'product', 'marketplace'],
  consumer: ['social', 'lifestyle', 'personal', 'home', 'family', 'daily', 'app', 'community'],
  b2b: ['enterprise', 'business', 'corporate', 'professional', 'team', 'company', 'B2B'],
};

interface ScatterPoint {
  genomeScore: number;
  ctr: number;
  verdict: string;
  vertical: string;
}

function classifyVertical(idea: string): string {
  const lowerIdea = idea.toLowerCase();
  for (const [vertical, keywords] of Object.entries(VERTICAL_KEYWORDS)) {
    if (keywords.some((kw) => lowerIdea.includes(kw))) {
      return vertical;
    }
  }
  return 'other';
}

export function CalibrationScatterPlot({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);
  const [hoveredPoint, setHoveredPoint] = useState<ScatterPoint | null>(null);

  // Prepare scatter plot data
  const scatterData: ScatterPoint[] = sprints
    .filter((sprint: { genome: { composite_score: any; }; campaign: { angle_metrics: { blended_ctr: any; }; }; }) => sprint.genome?.composite_score && sprint.campaign?.angle_metrics?.blended_ctr)
    .map((sprint: { genome: { composite_score: any; }; campaign: { angle_metrics: { blended_ctr: number; }; }; verdict: { aggregate_verdict: any; }; idea: string; }) => ({
      genomeScore: sprint.genome.composite_score,
      ctr: sprint.campaign.angle_metrics.blended_ctr * 100,
      verdict: sprint.verdict?.aggregate_verdict || 'UNKNOWN',
      vertical: classifyVertical(sprint.idea),
    }));

  // Calculate linear regression trendline
  const n = scatterData.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  scatterData.forEach((point) => {
    const x = point.genomeScore;
    const y = point.ctr;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;
  const intercept = n > 0 ? (sumY - slope * sumX) / n : 0;

  if (isLoading || scatterData.length === 0) {
    return (
      <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          CALIBRATION: GENOME SCORE VS CTR
        </div>
        <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
          No data yet
        </div>
      </div>
    );
  }

  const width = 400;
  const height = 250;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (genomeScore: number) => padding.left + (genomeScore / 100) * chartWidth;
  const getY = (ctr: number) => padding.top + chartHeight - (ctr / 5) * chartHeight;

  const verdictColor = (verdict: string) => {
    if (verdict === 'GO') return 'var(--signal-go)';
    if (verdict === 'NO-GO') return 'var(--signal-no-go)';
    if (verdict === 'ITERATE') return 'var(--signal-iterate)';
    return 'var(--signal-neutral)';
  };

  const trendlineStart = { x: 0, y: intercept };
  const trendlineEnd = { x: 100, y: slope * 100 + intercept };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}
    >
      <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        CALIBRATION: GENOME SCORE VS CTR
      </div>
      <div style={{ position: 'relative' }}>
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
          {/* Axis lines */}
          <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="var(--surface-border)" strokeWidth={1} />
          <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--surface-border)" strokeWidth={1} />

          {/* X-axis ticks */}
          {[0, 20, 40, 60, 80, 100].map((tick) => (
            <line
              key={tick}
              x1={getX(tick)}
              y1={height - padding.bottom}
              x2={getX(tick)}
              y2={height - padding.bottom + 5}
              stroke="var(--surface-border)"
              strokeWidth={1}
            />
          ))}

          {/* Y-axis ticks */}
          {[0, 1, 2, 3, 4, 5].map((tick) => (
            <line
              key={tick}
              x1={padding.left - 5}
              y1={getY(tick)}
              x2={padding.left}
              y2={getY(tick)}
              stroke="var(--surface-border)"
              strokeWidth={1}
            />
          ))}

          {/* X-axis labels */}
          {[0, 20, 40, 60, 80, 100].map((tick) => (
            <text
              key={tick}
              x={getX(tick)}
              y={height - 10}
              fill="var(--text-tertiary)"
              fontSize="10"
              textAnchor="middle"
              fontFamily="var(--font-mono)"
            >
              {tick}
            </text>
          ))}

          {/* Y-axis labels */}
          {[0, 1, 2, 3, 4, 5].map((tick) => (
            <text
              key={tick}
              x={padding.left - 10}
              y={getY(tick) + 4}
              fill="var(--text-tertiary)"
              fontSize="10"
              textAnchor="end"
              fontFamily="var(--font-mono)"
            >
              {tick}
            </text>
          ))}

          {/* Axis titles */}
          <text
            x={padding.left + chartWidth / 2}
            y={height - 5}
            fill="var(--text-tertiary)"
            fontSize="10"
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            style={{ textTransform: 'uppercase' }}
          >
            GENOME SCORE
          </text>
          <text
            x={padding.left - 35}
            y={padding.top + chartHeight / 2}
            fill="var(--text-tertiary)"
            fontSize="10"
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            style={{ textTransform: 'uppercase' }}
            transform={`rotate(-90, ${padding.left - 35}, ${padding.top + chartHeight / 2})`}
          >
            CAMPAIGN CTR %
          </text>

          {/* Trendline */}
          <line
            x1={getX(trendlineStart.x)}
            y1={getY(trendlineStart.y)}
            x2={getX(trendlineEnd.x)}
            y2={getY(trendlineEnd.y)}
            stroke="var(--accent-purple)"
            strokeWidth={2}
            opacity={0.4}
          />

          {/* Scatter points */}
          {scatterData.map((point, i) => (
            <circle
              key={i}
              cx={getX(point.genomeScore)}
              cy={getY(point.ctr)}
              r={5}
              fill={verdictColor(point.verdict)}
              onMouseEnter={() => setHoveredPoint(point)}
              onMouseLeave={() => setHoveredPoint(null)}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              left: getX(hoveredPoint.genomeScore),
              top: getY(hoveredPoint.ctr) - 60,
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
            <div>Genome: {hoveredPoint.genomeScore.toFixed(0)}</div>
            <div>CTR: {hoveredPoint.ctr.toFixed(2)}%</div>
            <div>Vertical: {hoveredPoint.vertical}</div>
            <div>Verdict: {hoveredPoint.verdict}</div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
