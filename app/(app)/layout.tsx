'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { AppHeader } from '@/components/app-header';
import { CommandPalette } from '@/components/command-palette';
import { useAppStore } from '@/lib/store';

function DemoDetector() {
  const searchParams = useSearchParams();
  const { setDemo } = useAppStore();

  useEffect(() => {
    const demo = searchParams.get('demo');
    if (demo === '1') {
      setDemo(true);
    }
  }, [searchParams, setDemo]);

  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-[1280px]">
            <Suspense>
              <DemoDetector />
            </Suspense>
            {children}
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
