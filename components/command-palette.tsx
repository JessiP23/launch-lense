'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Shield, Zap, BarChart3, FileText, Settings, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';

const commands = [
  { id: 'accounts', label: 'Go to Accounts', icon: Shield, href: '/accounts' },
  { id: 'connect', label: 'Connect Ad Account', icon: Shield, href: '/accounts/connect' },
  { id: 'tests', label: 'Go to Tests', icon: Zap, href: '/tests' },
  { id: 'new-test', label: 'Create New Test', icon: Zap, href: '/tests/new' },
  { id: 'reports', label: 'Go to Reports', icon: BarChart3, href: '/reports' },
  { id: 'benchmarks', label: 'View Benchmarks', icon: FileText, href: '/benchmarks' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
];

export function CommandPalette() {
  const { cmdkOpen, setCmdkOpen, canLaunch } = useAppStore();
  const [query, setQuery] = useState('');
  const router = useRouter();

  const filtered = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdkOpen(!cmdkOpen);
      }
      if (e.key === 'Escape') {
        setCmdkOpen(false);
      }
    },
    [cmdkOpen, setCmdkOpen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const executeCommand = (href: string, id: string) => {
    // Block test creation if healthgate is red
    if ((id === 'new-test') && !canLaunch) {
      return;
    }
    setCmdkOpen(false);
    setQuery('');
    router.push(href);
  };

  return (
    <AnimatePresence>
      {cmdkOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-[#111110]/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCmdkOpen(false)}
          />
          <motion.div
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <div className="rounded-xl border border-[#E8E4DC] bg-white shadow-xl shadow-[#111110]/8 overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-2.5 px-4 border-b border-[#E8E4DC]">
                <Search className="w-4 h-4 text-[#8C8880] shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a command..."
                  className="flex-1 h-12 bg-transparent text-[0.9375rem] text-[#111110] placeholder:text-[#8C8880] outline-none"
                  autoFocus
                />
                <button
                  onClick={() => setCmdkOpen(false)}
                  className="w-6 h-6 flex items-center justify-center rounded-md border border-[#E8E4DC] text-[#8C8880] hover:bg-[#F3F0EB] hover:text-[#111110] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-64 overflow-y-auto p-1.5">
                {filtered.map((cmd) => {
                  const disabled = cmd.id === 'new-test' && !canLaunch;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => executeCommand(cmd.href, cmd.id)}
                      disabled={disabled}
                      className="flex items-center gap-3 w-full px-3 py-2.5 text-[0.875rem] rounded-lg text-left transition-colors hover:bg-[#F3F0EB] disabled:opacity-40 disabled:cursor-not-allowed text-[#111110]"
                    >
                      <cmd.icon className="w-4 h-4 text-[#8C8880] shrink-0" />
                      <span className="font-medium">{cmd.label}</span>
                      {disabled && (
                        <span className="ml-auto text-[0.6875rem] font-medium text-[#DC2626]">
                          Blocked by Healthgate
                        </span>
                      )}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="px-3 py-8 text-center text-[0.875rem] text-[#8C8880]">
                    No commands found.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
