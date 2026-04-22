'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { HealthgateRing } from '@/components/healthgate-ring';
import { useAppStore } from '@/lib/store';

const navItems = [
  { href: '/accounts',   label: 'Accounts' },
  { href: '/tests',      label: 'Tests' },
  { href: '/reports',    label: 'Reports' },
  { href: '/benchmarks', label: 'Benchmarks' },
  { href: '/settings',   label: 'Settings' },
];

export function AppSidebar() {
  const pathname = usePathname();
  const healthSnapshot = useAppStore((s) => s.healthSnapshot);

  return (
    <aside className="flex flex-col w-56 border-r border-[#E8E4DC] bg-[#FAFAF8] h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-[#E8E4DC]">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="10" cy="10" r="9" stroke="#111110" strokeWidth="1.5" />
          <circle cx="10" cy="10" r="5" fill="#111110" />
          <path d="M8.5 11.5L11.5 8.5M11.5 8.5H9.5M11.5 8.5V10.5" stroke="#FAFAF8" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-display text-[0.9375rem] font-bold tracking-tight text-[#111110]">
          LaunchLense
        </span>
      </div>

      {/* Healthgate summary */}
      {healthSnapshot && (
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#E8E4DC]">
          <HealthgateRing
            score={healthSnapshot.score}
            status={healthSnapshot.status}
            checks={healthSnapshot.checks}
            size={38}
          />
          <div>
            <div className="text-[0.625rem] uppercase tracking-[0.08em] text-[#8C8880] font-medium">
              Healthgate™
            </div>
            <div className="font-mono font-bold tabular-nums text-[0.8125rem] text-[#111110]">
              {healthSnapshot.score}/100
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-px px-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center px-3 py-[7px] text-[0.875rem] transition-colors rounded-lg',
                isActive
                  ? 'bg-[#F3F0EB] text-[#111110] font-medium border-l-2 border-[#111110] rounded-l-none pl-[10px]'
                  : 'text-[#8C8880] hover:text-[#111110] hover:bg-[#F3F0EB] font-normal'
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[#E8E4DC]">
        <div className="text-[0.6875rem] text-[#8C8880]">LaunchLense v0.1</div>
      </div>
    </aside>
  );
}
