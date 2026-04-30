'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { SprintCanvas } from '@/components/canvas/sprint-canvas';

function CanvasWithParams() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPanel = searchParams.get('panel') ?? undefined;
  const openNew = searchParams.has('new');

  useEffect(() => {
    if (!openNew && !initialPanel) return;
    const timeout = setTimeout(() => router.replace(`/canvas/${encodeURIComponent(params.id)}`, { scroll: false }), 400);
    return () => clearTimeout(timeout);
  }, [initialPanel, openNew, params.id, router]);

  return (
    <SprintCanvas
      initialPanel={initialPanel}
      initialSprint={params.id}
      openNew={openNew}
    />
  );
}

export default function CanvasSprintPage() {
  return (
    <Suspense fallback={null}>
      <CanvasWithParams />
    </Suspense>
  );
}
