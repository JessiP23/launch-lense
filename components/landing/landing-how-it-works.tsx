'use client';

import { ScrollReveal } from '@/components/landing/scroll-reveal';

const steps = [
  {
    n: '01',
    title: 'Connect your ad account(s)',
    body: 'Link Google, Meta, LinkedIn, and/or TikTok via OAuth. Healthgate™ scans the account you launch with and flags issues before a dollar moves.',
  },
  {
    n: '02',
    title: 'Describe your startup idea',
    body: 'Optional: run Genome first for a free, fast preview. Then write your idea in plain English — we generate 3 ad angles (headline, body, CTA) per value prop.',
  },
  {
    n: '03',
    title: 'We build and launch',
    body: 'We create your landing page, wire the campaign on your chosen network, and send cold traffic. Your $500 test budget goes to work immediately.',
  },
  {
    n: '04',
    title: 'Receive your verdict',
    body: 'After 48 hours or $500 spend, you get a GO / NO-GO / ITERATE verdict with full CTR data, angle breakdown, and a downloadable PDF report.',
  },
] as const;

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-[var(--color-canvas)] py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">Process</p>
          <h2 className="mt-3 font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold tracking-[-0.03em] text-[var(--color-ink)]">
            From idea to verdict in 4 steps.
          </h2>
          <p className="mt-4 text-[15px] leading-[1.65] text-[var(--color-muted)]">
            No surveys. No assumptions. Real people, real clicks, real data.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <ScrollReveal key={s.n} delay={i * 0.07}>
              <article className="h-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 transition-colors duration-200 hover:border-[var(--color-border-2)]">
                <div className="font-display text-[3.5rem] font-extrabold leading-none text-[var(--color-raised)] select-none">
                  {s.n}
                </div>
                <h3 className="mt-5 font-display text-[17px] font-bold tracking-tight text-[var(--color-ink)]">
                  {s.title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.7] text-[var(--color-muted)]">{s.body}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>

        <div className="mt-10 hidden border-t border-dashed border-[var(--color-border)] lg:block" aria-hidden />
      </div>
    </section>
  );
}
