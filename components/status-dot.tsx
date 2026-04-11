import { cn } from '@/lib/utils';
import { statusColor } from '@/lib/tokens';

interface StatusDotProps {
  status: 'red' | 'yellow' | 'green' | string;
  className?: string;
  pulse?: boolean;
}

export function StatusDot({ status, className, pulse = false }: StatusDotProps) {
  const color = statusColor(status);
  return (
    <span
      className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', className)}
      style={{ backgroundColor: color }}
    >
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
          style={{ backgroundColor: color }}
        />
      )}
    </span>
  );
}
