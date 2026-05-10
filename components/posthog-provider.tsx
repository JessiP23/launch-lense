'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initPosthog, maybeStartSessionRecording } from '@/lib/analytics/client';

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';

  useEffect(() => {
    initPosthog();
  }, []);

  useEffect(() => {
    maybeStartSessionRecording(pathname);
  }, [pathname]);

  return <>{children}</>;
}
