import { cn } from '@/lib/utils';

export type LandingVerdict = 'GO' | 'NO-GO' | 'ITERATE';

const styles: Record<LandingVerdict, string> = {
  GO: 'bg-[var(--color-go-bg)] text-[var(--color-go)] border border-[var(--color-go-border)]',
  'NO-GO':
    'bg-[var(--color-stop-bg)] text-[var(--color-stop)] border border-[var(--color-stop-border)]',
  ITERATE:
    'bg-[var(--color-warn-bg)] text-[var(--color-warn)] border border-[var(--color-warn-border)]',
};

export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: LandingVerdict;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-tight',
        styles[verdict],
        className
      )}
    >
      {verdict}
    </span>
  );
}
