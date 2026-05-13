import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Skeleton — single primitive for loading states. Uses tokenized surface-2
 * with a subtle shimmer via Tailwind's animate-pulse. Pair multiple
 * skeletons inside a list/grid to match final layout.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-2', className)}
      aria-hidden
    />
  );
}
