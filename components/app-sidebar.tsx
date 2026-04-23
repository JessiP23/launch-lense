'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, ChevronLeft, ChevronRight, FileText, Settings, Shield, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/accounts', label: 'Accounts', icon: Shield },
  { href: '/tests', label: 'Tests', icon: Zap },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/benchmarks', label: 'Benchmarks', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'relative shrink-0 flex h-full flex-col border-r border-[#E8E4DC] bg-white shadow-[4px_0_24px_-12px_rgba(17,17,16,0.08)] transition-[width] duration-200 ease-out',
          sidebarCollapsed ? 'w-[52px]' : 'w-56'
        )}
      >
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute top-1/2 -right-2 z-20 flex h-14 w-4 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-[#E8E4DC] bg-white text-[#8C8880] shadow-sm hover:bg-[#F3F0EB] hover:text-[#111110] transition-colors"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>

        <div
          className={cn(
            'flex h-14 shrink-0 items-center border-b border-[#E8E4DC]',
            sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-5'
          )}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle cx="10" cy="10" r="9" stroke="#111110" strokeWidth="1.5" />
            <circle cx="10" cy="10" r="5" fill="#111110" />
            <path
              d="M8.5 11.5L11.5 8.5M11.5 8.5H9.5M11.5 8.5V10.5"
              stroke="#FFFFFF"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {!sidebarCollapsed && (
            <span className="font-display text-[0.9375rem] font-bold tracking-tight text-[#111110] truncate">
              LaunchLense
            </span>
          )}
        </div>

        <nav
          className={cn(
            'min-h-0 flex-1 space-y-px overflow-y-auto py-3',
            sidebarCollapsed ? 'px-1.5' : 'px-3'
          )}
        >
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex h-9 w-full items-center justify-center rounded-lg transition-colors',
                        isActive
                          ? 'bg-[#F3F0EB] text-[#111110]'
                          : 'text-[#8C8880] hover:bg-[#F3F0EB] hover:text-[#111110]'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-[7px] text-[0.875rem] transition-colors rounded-lg',
                  isActive
                    ? 'bg-[#F3F0EB] text-[#111110] font-medium border-l-2 border-[#111110] rounded-l-none pl-[10px]'
                    : 'text-[#8C8880] hover:text-[#111110] hover:bg-[#F3F0EB] font-normal'
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {!sidebarCollapsed ? (
          <div className="shrink-0 border-t border-[#E8E4DC] px-5 py-4">
            <div className="text-[0.6875rem] text-[#8C8880]">LaunchLense v0.1</div>
          </div>
        ) : (
          <div className="h-px shrink-0 border-t border-[#E8E4DC]" aria-hidden />
        )}
      </aside>
    </TooltipProvider>
  );
}
