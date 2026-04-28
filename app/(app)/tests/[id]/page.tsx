'use client';
import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

// Sprint detail now lives in the canvas node panel.
export default function TestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  useEffect(() => { router.replace(`/?sprint=${id}`); }, [router, id]);
  return null;
}
