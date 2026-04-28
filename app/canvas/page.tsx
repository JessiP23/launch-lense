'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SprintCanvas } from '@/components/canvas/sprint-canvas';
import { CommandPalette } from '@/components/command-palette';
import { Suspense } from 'react';

function CanvasWithParams() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialPanel = searchParams.get('panel') ?? undefined;
  const initialSprint = searchParams.get('sprint') ?? undefined;
  const openNew = searchParams.has('new');

  // Clean up query params from URL after mount
  useEffect(() => {
    const hasParams = searchParams.has('sprint') || searchParams.has('new') || searchParams.has('panel');
    if (hasParams) {
      const timeout = setTimeout(() => {
        router.replace('/canvas', { scroll: false });
      }, 400);
      return () => clearTimeout(timeout);
    }
  }, [router, searchParams]);

  return <SprintCanvas initialPanel={initialPanel} initialSprint={initialSprint} openNew={openNew} />;
}

export default function CanvasPage() {
  return (
    <Suspense fallback={null}>
      <CanvasWithParams />
      <CommandPalette />
    </Suspense>
  );
}
