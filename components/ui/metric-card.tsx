import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * MetricCard — investor-grade metric display.
 *
 *   <MetricCard
 *     label="Spend"
 *     value="$1,240"
 *     delta={{ value: '+12%', tone: 'success' }}
 *     hint="vs. yesterday"
 *   />
 *
 * Visual rules:
 * - Tabular-nums numerals so values align in grids.
 * - Tone applies to delta only — main value stays ink-1 for calm hierarchy.
 * - No border by default (use whitespace to group). Pass `bordered` to enable.
 */

type Tone = 'neutral' | 'success' | 'warn' | 'danger';

const toneText: Record<Tone, string> = {
  neutral: 'text-ink-2',
  success: 'text-success',
  warn: 'text-warn',
  danger: 'text-danger',
};

export function MetricCard({
  label,
  value,
  delta,
  hint,
  bordered = false,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: { value: React.ReactNode; tone?: Tone };
  hint?: React.ReactNode;
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5',
        bordered && 'rounded-lg border border-border bg-surface-1 p-4',
        className,
      )}
    >
      <div className="text-[11px] uppercase tracking-[0.08em] text-ink-3 font-medium">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-ink-1 tabular-nums leading-none">
          {value}
        </span>
        {delta ? (
          <span
            className={cn(
              'text-xs font-medium tabular-nums',
              toneText[delta.tone ?? 'neutral'],
            )}
          >
            {delta.value}
          </span>
        ) : null}
      </div>
      {hint ? <div className="text-xs text-ink-3">{hint}</div> : null}
    </div>
  );
}
