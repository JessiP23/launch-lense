'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Campaign setup now lives in the canvas detail panel.
export default function TestSetupRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/canvas?sprint=${id}&panel=campaign`);
  }, [id, router]);

  return null;
}
