'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  Zap,
  BarChart3,
  FileText,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HealthgateRing } from '@/components/healthgate-ring';
import { useAppStore } from '@/lib/store';

const navItems = [
  { href: '/accounts', label: 'Accounts', icon: Shield },
  { href: '/tests', label: 'Tests', icon: Zap },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/benchmarks', label: 'Benchmarks', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const healthSnapshot = useAppStore((s) => s.healthSnapshot);

  return (
    <aside className="flex flex-col w-56 border-r border-[#262626] bg-[#0A0A0A] h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-[#262626]">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          {/* Lens aperture mark */}
          <circle cx="11" cy="11" r="10" stroke="#FAFAFA" strokeWidth="1.5" />
          <circle cx="11" cy="11" r="5.5" fill="#FAFAFA" />
          {/* Launch arrow */}
          <path d="M9 13L13 9M13 9H10M13 9V12" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-semibold text-sm tracking-tight">LaunchLense</span>
      </div>

      {/* Healthgate summary */}
      {healthSnapshot && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#262626]">
          <HealthgateRing
            score={healthSnapshot.score}
            status={healthSnapshot.status}
            checks={healthSnapshot.checks}
            size={40}
          />
          <div className="text-xs">
            <div className="text-[#A1A1A1]">Healthgate™</div>
            <div className="font-mono font-bold tabular-nums">
              {healthSnapshot.score}/100
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                isActive
                  ? 'text-[#FAFAFA] bg-[#171717]'
                  : 'text-[#A1A1A1] hover:text-[#FAFAFA] hover:bg-[#111111]'
              )}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#262626]">
        <div className="text-[10px] text-[#A1A1A1]">
          LaunchLense v0.1
        </div>
      </div>
    </aside>
  );
}
