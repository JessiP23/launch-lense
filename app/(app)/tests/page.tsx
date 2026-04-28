'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Sprint list now lives in the canvas toolbar sprint selector.
export default function TestsPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, [router]);
  return null;
}
