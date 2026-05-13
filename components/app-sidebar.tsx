'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  BarChart3,
  Settings,
  Plug,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

// App sidebar — Linear-style. Persistent, collapsible to 56px.
// Active state is computed from the URL segment (no extra state).
//
// Sections:
//   Workspace: Sprints (/canvas), Benchmarks (/benchmarks)
//   Account:   Connections (/accounts), Settings (/settings)
//
// Routes are intentionally not renamed in Phase 1 — labels are aspirational
// ("Sprints" pointing at the existing /canvas route) so we don't break
// anything until Phase 2 redesigns the canvas itself.

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (pathname: string) => boolean;
};

const workspace: NavItem[] = [
  { href: '/canvas', label: 'Sprints', icon: LayoutGrid, match: (p) => p.startsWith('/canvas') || p.startsWith('/tests') },
  { href: '/benchmarks', label: 'Benchmarks', icon: BarChart3 },
];
const account: NavItem[] = [
  { href: '/accounts', label: 'Connections', icon: Plug, match: (p) => p.startsWith('/accounts') },
  { href: '/settings', label: 'Settings', icon: Settings, match: (p) => p.startsWith('/settings') },
];

export function AppSidebar() {
  const pathname = usePathname() ?? '/';
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const setCollapsed = useAppStore((s) => s.setSidebarCollapsed);

  const width = collapsed ? 'w-[56px]' : 'w-[224px]';

  return (
    <nav
      className={cn(
        'flex flex-col h-screen border-r border-border bg-surface-1 transition-[width] duration-150 ease-out',
        width,
      )}
      aria-label="Primary"
    >
      {/* Brand */}
      <div className={cn('flex items-center h-12 px-3', collapsed && 'justify-center')}>
        <Link href="/canvas" className="flex items-center gap-2 min-w-0">
          <Image src="/logo.png" alt="LaunchLense" width={20} height={20} className="rounded-sm" />
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight text-ink-1 truncate">
              LaunchLense
            </span>
          )}
        </Link>
      </div>

      <div className="h-px bg-border" />

      {/* Workspace */}
      <Section label="Workspace" collapsed={collapsed}>
        {workspace.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
        ))}
      </Section>

      {/* Account */}
      <Section label="Account" collapsed={collapsed}>
        {account.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
        ))}
      </Section>

      <div className="flex-1" />

      {/* Footer — user + collapse */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-3 border-t border-border',
        collapsed && 'flex-col',
      )}>
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'h-7 w-7',
            },
          }}
        />
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:text-ink-1 hover:bg-surface-2 transition-colors',
            collapsed && 'ml-0',
          )}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>
    </nav>
  );
}

function Section({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="px-2 py-2">
      {!collapsed && (
        <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3">
          {label}
        </div>
      )}
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const active = item.match ? item.match(pathname) : pathname === item.href;
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          'group relative flex items-center gap-2.5 h-8 px-2 rounded-md text-[13px] transition-colors',
          active
            ? 'bg-surface-2 text-ink-1'
            : 'text-ink-2 hover:text-ink-1 hover:bg-surface-2/60',
          collapsed && 'justify-center px-0',
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-ink-1' : 'text-ink-3 group-hover:text-ink-2')} />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-sm bg-accent"
          />
        )}
      </Link>
    </li>
  );
}
