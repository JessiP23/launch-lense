import Link from 'next/link';
import Image from 'next/image';
import { LandingFooter } from '@/components/landing/landing-footer';

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared chrome for marketing-site legal pages (Privacy, Terms, Data Deletion).
 * Keeps Tailwind tokens consistent with the rest of the landing surface and
 * stays standalone (no Clerk auth) so search engines and Meta App Review can
 * crawl them without authentication.
 */
export function LegalPage({ title, lastUpdated, intro, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)]">
      {/* Lightweight legal-page header — no auth-gated nav. */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-canvas)]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] bg-white ring-1 ring-black/10 shadow-sm">
              <Image src="/logo.png" alt="LaunchLense" width={20} height={20} className="h-5 w-5" />
            </span>
            <span className="font-display text-[15px] font-bold tracking-tight">LaunchLense</span>
          </Link>
          <nav className="flex items-center gap-5 font-mono text-[12px]">
            <Link href="/privacy" className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]">
              Privacy
            </Link>
            <Link href="/data-deletion" className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]">
              Data deletion
            </Link>
            <Link href="/terms" className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-20">
        <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--color-muted)]">
          Legal
        </div>
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-[1.1] tracking-[-0.03em]">
          {title}
        </h1>
        <p className="mt-3 text-[13px] text-[var(--color-muted)]">Last updated: {lastUpdated}</p>

        {intro ? (
          <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[15px] leading-[1.7] text-[var(--color-ink)]">
            {intro}
          </div>
        ) : null}

        <article className="legal-prose mt-10">{children}</article>
      </main>

      <LandingFooter />
    </div>
  );
}
