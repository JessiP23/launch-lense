import * as React from 'react';
import { cn } from '@/lib/utils';

function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline';
}) {
  const variantStyles = {
    default: 'bg-[#171717] text-[#FAFAFA] border-[#262626]',
    success: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20',
    warning: 'bg-[#EAB308]/10 text-[#EAB308] border-[#EAB308]/20',
    danger: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
    outline: 'border-[#262626] text-[#A1A1A1]',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
