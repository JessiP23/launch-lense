'use client';

import { ScrollReveal } from '@/components/landing/scroll-reveal';

const quotes = [
  {
    quote:
      "Killed our 'AI for realtors' idea in 48h. Would've wasted 6 weeks building otherwise. NO-GO verdict was clear — 0.4% CTR across all angles. Painful but correct.",
    name: 'Marcus T.',
    role: 'Founder',
    tag: 'Early access',
  },
  {
    quote:
      'Healthgate caught domain verification before launch. Fixed in 10 min. Without it we’d have spent $500 and gotten 0 impressions. Setup check saved the test.',
    name: 'Priya S.',
    role: 'Founder, Stealth',
    tag: 'Early access',
  },
  {
    quote:
      'I spend $3k+ per idea on manual tests. If you can get me a real verdict for $549, I’m in. Just need to see one full PDF report first — specifically the angle breakdown.',
    name: 'Jordan K.',
    role: 'Founder, Stealth',
    tag: 'Waitlist',
  },
] as const;

export function LandingTestimonials() {
  return (
    <section className="bg-[var(--color-canvas)] py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text- font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
            What founders say
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold tracking-[-0.03em] text-[var(--color-ink)]">
            Founders trust the data.
          </h2>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {quotes.map((q, i) => (
            <ScrollReveal key={q.name} delay={i * 0.06}>
              <figure className="flex h-full flex-col gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors duration-200 hover:border-[var(--color-border-2)]">
                <blockquote className="text- leading-[1.7] text-[var(--color-ink)]">
                  &ldquo;{q.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-auto border-t border-[var(--color-raised)] pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display text- font-semibold text-[var(--color-ink)]">{q.name}</div>
                      <div className="mt-0.5 text- text-[var(--color-muted)]">{q.role}</div>
                    </div>
                    <div className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-raised)] px-2 py-0.5">
                      <span className="font-mono text- font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        {q.tag}
                      </span>
                    </div>
                  </div>
                </figcaption>
              </figure>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}