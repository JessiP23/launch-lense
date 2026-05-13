import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * SectionHeader — title + optional eyebrow + optional actions slot.
 * Use at the top of every page section to establish hierarchy without borders.
 */
export function SectionHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex items-start justify-between gap-6 mb-6', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] uppercase tracking-[0.08em] text-ink-3 mb-2 font-medium">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold text-ink-1 truncate">{title}</h1>
        {description ? (
          <p className="text-sm text-ink-2 mt-1.5 max-w-2xl">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </header>
  );
}
