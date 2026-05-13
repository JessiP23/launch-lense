import * as React from 'react';
import { cn } from '@/lib/utils';

// PageShell — the canonical layout primitive for every authenticated screen.
//
// Composition:
//   <PageShell sidebar={<AppSidebar />} header={<AppHeader />}>
//     <PageShell.Main>...</PageShell.Main>
//     <PageShell.Aside>...</PageShell.Aside>   // optional right rail
//   </PageShell>
//
// - Three-column grid: sidebar / main / optional aside.
// - Sticky header within the main column.
// - Server-component-safe; no client state.
// - All colours come from v2 tokens; no inline hex.

type PageShellProps = {
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function PageShell({ sidebar, header, children, className }: PageShellProps) {
  return (
    <div
      className={cn(
        'min-h-screen bg-bg text-ink-1 grid',
        sidebar ? 'grid-cols-[auto_1fr]' : 'grid-cols-1',
        className,
      )}
    >
      {sidebar ? (
        <aside className="border-r border-border bg-surface-1 sticky top-0 h-screen overflow-y-auto">
          {sidebar}
        </aside>
      ) : null}
      <div className="flex flex-col min-w-0">
        {header ? (
          <header className="sticky top-0 z-20 h-12 border-b border-border bg-bg/80 backdrop-blur-md">
            {header}
          </header>
        ) : null}
        <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-[1fr_auto]">
          {children}
        </div>
      </div>
    </div>
  );
}

function Main({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cn('min-w-0 px-8 py-8', className)}>{children}</main>;
}
Main.displayName = 'PageShell.Main';

function Aside({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <aside
      className={cn(
        'hidden lg:block w-[340px] border-l border-border bg-surface-1 px-6 py-8 overflow-y-auto',
        className,
      )}
    >
      {children}
    </aside>
  );
}
Aside.displayName = 'PageShell.Aside';

PageShell.Main = Main;
PageShell.Aside = Aside;
