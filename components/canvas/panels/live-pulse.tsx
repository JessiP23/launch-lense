'use client';

import { motion } from 'framer-motion';

interface LivePulseProps {
  /** "live" = green pulsing dot; "polling" = warm dot, slower; "idle" = grey static. */
  state?: 'live' | 'polling' | 'idle' | 'stopped';
  label?: string;
  className?: string;
}

const STATE_STYLE: Record<NonNullable<LivePulseProps['state']>, { color: string; ring: string; pulse: boolean; defaultLabel: string }> = {
  live:     { color: '#16A34A', ring: 'rgba(22,163,74,0.18)',  pulse: true,  defaultLabel: 'Live' },
  polling:  { color: '#D97706', ring: 'rgba(217,119,6,0.18)',  pulse: true,  defaultLabel: 'Polling' },
  idle:     { color: '#8C8880', ring: 'rgba(140,136,128,0.18)', pulse: false, defaultLabel: 'Idle' },
  stopped:  { color: '#DC2626', ring: 'rgba(220,38,38,0.18)',  pulse: false, defaultLabel: 'Paused' },
};

/**
 * Standardized live-status indicator for canvas panels. One component, one
 * vocabulary — avoids the ad-hoc dots + labels each panel used to draw.
 */
export function LivePulse({ state = 'idle', label, className }: LivePulseProps) {
  const cfg = STATE_STYLE[state];
  const displayLabel = label ?? cfg.defaultLabel;

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px 3px 8px',
        borderRadius: 99,
        background: cfg.ring,
        color: cfg.color,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}
    >
      <span style={{ position: 'relative', width: 6, height: 6 }}>
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: cfg.color,
          }}
        />
        {cfg.pulse ? (
          <motion.span
            initial={{ scale: 1, opacity: 0.55 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: cfg.color,
            }}
          />
        ) : null}
      </span>
      <span>{displayLabel}</span>
    </span>
  );
}
