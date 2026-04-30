'use client';

import { Suspense } from 'react';
import { SprintCanvas } from '@/components/canvas/sprint-canvas';

/**
 * /canvas — empty canvas home.
 * Does NOT load any sprint. Sprint selection lives in the toolbar.
 * Navigate to /canvas/[id] to open a specific workflow.
 */
export default function CanvasPage() {
  return (
    <Suspense fallback={null}>
      <SprintCanvas />
    </Suspense>
  );
}
