'use client';

import { CommandPalette } from '@/components/command-palette';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CommandPalette />
    </>
  );
}
