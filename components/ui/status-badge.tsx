import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * StatusBadge — compact pill with semantic tone.
 *
 *   <StatusBadge tone="success">Active</StatusBadge>
 *   <StatusBadge tone="warn" dot>Learning</StatusBadge>
 *
 * Tones reuse v2 *-soft tokens for the background so badges feel calm,
 * not loud. A 6px dot can be enabled for live-state signals.
 */

type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger';

const toneStyles: Record<Tone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: 'bg-surface-2',     fg: 'text-ink-2',   dot: 'bg-ink-3' },
  accent:  { bg: 'bg-accent-soft',   fg: 'text-accent',  dot: 'bg-accent' },
  success: { bg: 'bg-success-soft',  fg: 'text-success', dot: 'bg-success' },
  warn:    { bg: 'bg-warn-soft',     fg: 'text-warn',    dot: 'bg-warn' },
  danger:  { bg: 'bg-danger-soft',   fg: 'text-danger',  dot: 'bg-danger' },
};

export function StatusBadge({
  children,
  tone = 'neutral',
  dot = false,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  const t = toneStyles[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
        t.bg,
        t.fg,
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} /> : null}
      {children}
    </span>
  );
}
