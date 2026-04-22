'use client';

import { useAppStore } from '@/lib/store';

export function AppHeader() {
  const { setCmdkOpen } = useAppStore();

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-[#E8E4DC] bg-[#FFFFFF]">
      <button
        onClick={() => setCmdkOpen(true)}
        className="flex items-center gap-2 h-8 px-3 rounded-lg border border-[#E8E4DC] bg-[#F3F0EB] text-[0.8125rem] text-[#8C8880] hover:border-[#111110]/20 hover:text-[#111110] transition-colors"
      >
        <span>Search…</span>
        <kbd className="ml-3 text-[0.625rem] text-[#8C8880] border border-[#E8E4DC] rounded px-1 py-0.5 font-mono">
          ⌘K
        </kbd>
      </button>
    </header>
  );
}
