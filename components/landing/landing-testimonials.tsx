'use client';

import { ScrollReveal } from '@/components/landing/scroll-reveal';

const quotes = [
  {
    quote:
      'We were about to spend 3 months building a B2B tool. LaunchLense told us in 48 hours there was no market. Saved us $200K.',
    name: 'Marcus T.',
    role: 'Founder, 3x exited',
  },
  {
    quote:
      'The Healthgate score caught a billing issue on our ad account before we went live. Without it, we would have launched a broken campaign.',
    name: 'Priya S.',
    role: 'Head of Growth, venture studio',
  },
  {
    quote:
      'I run 4–5 validations a month. The PDF reports are the first thing I show investors when they ask about demand signal.',
    name: 'Jordan K.',
    role: 'Serial founder',
  },
  {
    quote:
      'Finally a validation tool that uses actual ad data instead of customer discovery surveys. Night and day difference.',
    name: 'Elena R.',
    role: 'Partner, early-stage fund',
  },
] as const;

export function LandingTestimonials() {
  return (
    <section className="bg-[var(--color-canvas)] py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
            What founders say
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold tracking-[-0.03em] text-[var(--color-ink)]">
            Founders trust the data.
          </h2>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {quotes.map((q, i) => (
            <ScrollReveal key={q.name} delay={i * 0.06}>
              <figure className="flex h-full flex-col gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors duration-200 hover:border-[var(--color-border-2)]">
                <blockquote className="text-[15px] leading-[1.7] text-[var(--color-ink)]">
                  &ldquo;{q.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-auto border-t border-[var(--color-raised)] pt-4">
                  <div className="font-display text-[14px] font-semibold text-[var(--color-ink)]">{q.name}</div>
                  <div className="mt-0.5 text-[12px] text-[var(--color-muted)]">{q.role}</div>
                </figcaption>
              </figure>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
