'use client';

import Link from 'next/link';
import { ScrollReveal } from '@/components/landing/scroll-reveal';

export function LandingGenome() {
  return (
    <section id="genome" className="scroll-mt-20 border-y border-[var(--color-border)] bg-[var(--color-surface)] py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <ScrollReveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
              Before you buy ads
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.75rem,3.5vw,2.25rem)] font-bold leading-tight tracking-[-0.03em] text-[var(--color-ink)]">
              Genome
              <span className="text-[var(--color-muted)]"> — a go / no-go on your idea.</span>
            </h2>
            <p className="mt-4 text-[15px] leading-[1.7] text-[var(--color-muted)]">
              Paste your idea and get a fast, research-backed preview: market signals, risks, and a clear signal
              to pivot or proceed — before you connect an ad account or spend your test budget.
            </p>
            <ul className="mt-5 space-y-2 text-[14px] leading-relaxed text-[var(--color-ink)]">
              <li className="border-l-2 border-[var(--color-border)] pl-3 text-[var(--color-muted)]">
                Uses live research hooks + structured scoring — not a generic chat blurb.
              </li>
              <li className="border-l-2 border-[var(--color-border)] pl-3 text-[var(--color-muted)]">
                Pairs with live tests: Genome → Healthgate™ → $500 run across the channels you use.
              </li>
            </ul>
            <div className="mt-8">
              <Link
                href="/tests/new"
                className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-canvas)] px-7 text-[15px] font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-border-2)]"
              >
                Run Genome →
              </Link>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.08}>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-8">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--color-muted)]">
                Sample output
              </p>
              <p className="mt-3 font-display text-[18px] font-bold text-[var(--color-ink)]">Signal: ITERATE</p>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-muted)]">
                Demand is plausible but the wedge is underspecified. Tighten ICP and one killer outcome before
                you fund a $500 test.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['Competition', 'ICP', 'Risks', 'Next check'].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 font-mono text-[10px] text-[var(--color-muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
