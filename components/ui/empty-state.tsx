import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * EmptyState — guides the user when a list, panel, or page has no data yet.
 *
 *   <EmptyState
 *     icon={<Sparkles className="h-4 w-4" />}
 *     title="No sprints yet"
 *     description="Start a sprint to validate demand for an idea in 48 hours."
 *     action={<Button>New sprint</Button>}
 *   />
 *
 * Visual rules: centred, generous whitespace, single icon, single CTA.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-16 rounded-lg border border-dashed border-border bg-surface-1/40',
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-2 text-ink-2">
          {icon}
        </div>
      ) : null}
      <h2 className="text-base font-medium text-ink-1">{title}</h2>
      {description ? (
        <p className="mt-1.5 text-sm text-ink-2 max-w-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
