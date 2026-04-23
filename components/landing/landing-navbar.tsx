'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LANDING_EASE } from '@/components/landing/motion-variants';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const navLinks = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#genome', label: 'Genome' },
  { href: '#healthgate', label: 'Healthgate™' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'Docs' },
] as const;

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY >= 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-[var(--color-border)] bg-[var(--color-canvas)]/95 backdrop-blur-md'
            : 'border-b border-transparent bg-transparent'
        )}
      >
        <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-5 sm:px-6">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5">
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] bg-white ring-1 ring-black/10 shadow-sm">
              <Image
                src="/logo.png"
                alt="LaunchLense"
                width={20}
                height={20}
                className="h-5 w-5"
              />
            </span>
            <span className="font-display text-[15px] font-bold tracking-tight text-[var(--color-ink)]">
              LaunchLense
            </span>
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[14px] font-normal text-[var(--color-muted)] transition-colors duration-150 hover:text-[var(--color-ink)]"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-[60] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-[var(--color-ink)]/30 backdrop-blur-sm"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <motion.nav
              className="absolute inset-y-0 right-0 flex w-[min(100%,320px)] flex-col border-l border-[var(--color-border)] bg-[var(--color-canvas)] p-6"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: LANDING_EASE }}
            >
              <div className="mb-8 flex items-center justify-between">
                <span className="font-display text-[15px] font-bold">Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="font-mono text-[12px] text-[var(--color-muted)]"
                >
                  Close
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {navLinks.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-4 py-3 text-[16px] text-[var(--color-ink)] transition-colors hover:bg-[var(--color-raised)]"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
              <div className="mt-auto flex flex-col gap-3 border-t border-[var(--color-border)] pt-6">
                <Link
                  href="/accounts/connect"
                  className="rounded-lg px-4 py-3 text-[16px] text-[var(--color-muted)]"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign in
                </Link>
                <Link
                  href="/accounts/connect"
                  className="flex h-12 items-center justify-center rounded-full bg-[var(--color-ink)] text-[15px] font-semibold text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  Start free
                </Link>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
