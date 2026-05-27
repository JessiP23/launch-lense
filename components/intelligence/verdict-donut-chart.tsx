'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
import { motion } from 'framer-motion';

export function VerdictDonutChart({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);

  const verdictCounts = sprints.reduce((acc: any, sprint: any) => {
    const verdict = sprint.verdict?.aggregate_verdict || 'UNKNOWN';
    acc[verdict] = (acc[verdict] || 0) + 1;
    return acc;
  }, {});

  const goCount = verdictCounts['GO'] || 0;
  const noGoCount = verdictCounts['NO-GO'] || 0;
  const iterateCount = verdictCounts['ITERATE'] || 0;
  const total = goCount + noGoCount + iterateCount;

  const data = [
    { label: 'GO', count: goCount, color: 'var(--signal-go)' },
    { label: 'NO-GO', count: noGoCount, color: 'var(--signal-no-go)' },
    { label: 'ITERATE', count: iterateCount, color: 'var(--signal-iterate)' },
  ].filter((d) => d.count > 0);

  const largest = data.length > 0 ? data.reduce((max, d) => d.count > max.count ? d : max, data[0]) : null;

  if (isLoading || total === 0) {
    return (
      <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          VERDICT DISTRIBUTION
        </div>
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
          No data yet
        </div>
      </div>
    );
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 8;
  const gap = 4;

  let currentAngle = 0;
  const arcs = data.map((item) => {
    const percentage = item.count / total;
    const arcLength = (circumference * percentage) - gap;
    const startAngle = currentAngle;
    const endAngle = currentAngle + (percentage * 360);
    currentAngle = endAngle;

    return {
      ...item,
      arcLength,
      startAngle,
      endAngle,
    };
  });

  return (
    <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}>
      <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        VERDICT DISTRIBUTION
      </div>
      <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto' }}>
        <svg width={200} height={200} viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
          {arcs.map((arc, i) => {
            const startRad = (arc.startAngle * Math.PI) / 180;
            const endRad = (arc.endAngle * Math.PI) / 180;
            const x1 = 100 + radius * Math.cos(startRad);
            const y1 = 100 + radius * Math.sin(startRad);
            const x2 = 100 + radius * Math.cos(endRad);
            const y2 = 100 + radius * Math.sin(endRad);
            const largeArcFlag = arc.arcLength > circumference / 2 ? 1 : 0;

            return (
              <motion.circle
                key={arc.label}
                cx={100}
                cy={100}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={arc.arcLength}
                strokeDashoffset={arc.arcLength}
                initial={{ strokeDashoffset: arc.arcLength }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                style={{
                  transformOrigin: 'center',
                  transform: `rotate(${arc.startAngle}deg)`,
                }}
              />
            );
          })}
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
          {largest && (
            <>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {largest.label}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {largest.count}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
