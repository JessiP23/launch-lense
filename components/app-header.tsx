'use client';

import { Search, Command } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { HealthgateRing } from '@/components/healthgate-ring';

export function AppHeader() {
  const { healthSnapshot, setCmdkOpen } = useAppStore();

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-[#262626] bg-[#0A0A0A]">
      <div className="flex items-center gap-4">
        {/* Healthgate Ring in header — signature element */}
        {healthSnapshot && (
          <div className="flex items-center gap-2">
            <HealthgateRing
              score={healthSnapshot.score}
              status={healthSnapshot.status}
              checks={healthSnapshot.checks}
              size={32}
            />
            <span className="text-xs text-[#A1A1A1]">Healthgate™</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Cmd+K search */}
        <button
          onClick={() => setCmdkOpen(true)}
          className="flex items-center gap-2 h-8 px-3 rounded-md border border-[#262626] bg-[#111111] text-sm text-[#A1A1A1] hover:border-[#FAFAFA]/20 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search...</span>
          <kbd className="ml-4 flex items-center gap-0.5 text-[10px] text-[#A1A1A1] border border-[#262626] rounded px-1 py-0.5">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>
      </div>
    </header>
  );
}
