'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function RedirectPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/canvas?panel=accounts'); }, [router]);
  return null;
}
