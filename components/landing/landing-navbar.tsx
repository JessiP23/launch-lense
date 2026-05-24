'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/nextjs';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#genome', label: 'Genome' },
  { href: '#healthgate', label: 'Healthgate™' },
] as const;

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isSignedIn } = useAuth();

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
            ? 'border-b border-[rgba(0,0,0,0.07)] bg-[#ffffff]/95 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.07),0_2px_6px_rgba(0,0,0,0.04)]'
            : 'border-b border-transparent bg-transparent'
        )}
      >
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-6">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5">
            <span className="font-['Sora'] text-[15px] font-bold tracking-tight text-[#1a1a1a]">
              LaunchLense
            </span>
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="font-['Sora'] text-[14px] font-normal text-[#6b7280] transition-colors duration-150 hover:text-[#1a1a1a]"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Desktop auth buttons */}
          <div className="hidden items-center gap-3 md:flex">
            {isSignedIn ? (
              <>
                <Link
                  href="/canvas"
                  className="font-['Sora'] flex h-9 items-center rounded-full bg-[#111111] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-80"
                >
                  Dashboard
                </Link>
                <UserButton />
              </>
            ) : (
              <>
                <SignInButton mode="redirect">
                  <button className="font-['Sora'] text-[14px] text-[#6b7280] transition-colors hover:text-[#1a1a1a]">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="redirect">
                  <button className="font-['Sora'] flex h-9 items-center rounded-full bg-[#111111] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-80">
                    Start free
                  </button>
                </SignUpButton>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[rgba(0,0,0,0.04)] md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="#1a1a1a">
              <rect y="0" width="18" height="2" rx="1" />
              <rect y="6" width="18" height="2" rx="1" />
              <rect y="12" width="18" height="2" rx="1" />
            </svg>
          </button>
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
              className="absolute inset-0 bg-[#1a1a1a]/30 backdrop-blur-sm"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <motion.nav
              className="absolute inset-y-0 right-0 flex w-[min(100%,320px)] flex-col border-l border-[rgba(0,0,0,0.07)] bg-[#ffffff] p-6"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-8 flex items-center justify-between">
                <span className="font-['Sora'] text-[15px] font-bold">Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="font-['DM_Mono'] text-[12px] text-[#6b7280]"
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
                    className="font-['Sora'] rounded-lg px-4 py-3 text-[16px] text-[#1a1a1a] transition-colors hover:bg-[rgba(0,0,0,0.04)]"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
              <div className="mt-auto flex flex-col gap-3 border-t border-[rgba(0,0,0,0.07)] pt-6">
                {isSignedIn ? (
                  <>
                    <Link
                      href="/canvas"
                      className="font-['Sora'] flex h-12 items-center justify-center rounded-full bg-[#111111] text-[15px] font-semibold text-white"
                      onClick={() => setMobileOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <div className="flex justify-center">
                      <UserButton />
                    </div>
                  </>
                ) : (
                  <>
                    <SignInButton mode="redirect">
                      <button
                        className="font-['Sora'] rounded-lg px-4 py-3 text-[16px] text-[#6b7280]"
                        onClick={() => setMobileOpen(false)}
                      >
                        Sign in
                      </button>
                    </SignInButton>
                    <SignUpButton mode="redirect">
                      <button
                        className="font-['Sora'] flex h-12 items-center justify-center rounded-full bg-[#111111] text-[15px] font-semibold text-white"
                        onClick={() => setMobileOpen(false)}
                      >
                        Start free
                      </button>
                    </SignUpButton>
                  </>
                )}
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
