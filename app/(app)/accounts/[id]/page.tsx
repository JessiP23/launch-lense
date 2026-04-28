'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Account detail is represented by the Accounts node inside the canvas.
export default function AccountRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/canvas?panel=accounts');
  }, [router]);

  return null;
}
