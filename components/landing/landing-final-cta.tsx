'use client';

import Link from 'next/link';
import { ScrollReveal } from '@/components/landing/scroll-reveal';

export function LandingFinalCta() {
  return (
    <section id="final-cta" className="scroll-mt-20 bg-[var(--color-canvas)] py-32">
      <div className="mx-auto max-w-2xl px-5 text-center sm:px-6">
        <ScrollReveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
            Ready to validate?
          </p>
          <h2 className="mt-4 font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--color-ink)]">
            Stop guessing.
            <br />
            Start knowing.
          </h2>
          <p className="mt-5 text-[16px] leading-[1.65] text-[var(--color-muted)]">
            Your next startup idea deserves a real market signal — not a survey, not a mock landing page, not a gut
            feeling. Get the data.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/?panel=accounts"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-ink)] px-7 text-[15px] font-semibold text-white transition-colors hover:bg-[#2a2a28]"
            >
              Start validating
            </Link>
            <Link
              href="#pricing"
              className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-7 text-[15px] font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-border-2)]"
            >
              Talk to us
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
