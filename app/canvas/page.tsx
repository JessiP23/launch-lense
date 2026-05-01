'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SprintCanvas } from '@/components/canvas/sprint-canvas';

/**
 * /canvas — canvas home (no sprint in path).
 * Optional query `?sprint=<uuid>&panel=…` (e.g. OAuth return) selects a sprint the same way as /canvas/[id].
 */
function CanvasHomeInner() {
  const searchParams = useSearchParams();
  const sprint = searchParams.get('sprint') ?? undefined;
  const panel = searchParams.get('panel') ?? undefined;
  const openNew = searchParams.has('new');

  return (
    <SprintCanvas initialSprint={sprint} initialPanel={panel} openNew={openNew} />
  );
}

export default function CanvasPage() {
  return (
    <Suspense fallback={null}>
      <CanvasHomeInner />
    </Suspense>
  );
}
