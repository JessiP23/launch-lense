'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// New sprint creation is now handled by the canvas New Sprint modal.
export default function NewTestPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/?new=1'); }, [router]);
  return null;
}
