'use client';

import { ScrollReveal } from '@/components/landing/scroll-reveal';

const stats = [
  { value: '48h', label: 'Average verdict time' },
  { value: '94%', label: 'Verdict accuracy rate' },
] as const;

export function LandingStatsBar() {
  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)] py-14">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-12 md:gap-20">
          {stats.map((s, i) => (
            <ScrollReveal key={s.label} delay={i * 0.06} className="text-center">
              <div className="font-display text-[44px] font-extrabold leading-none tracking-tight text-[var(--color-ink)]">
                {s.value}
              </div>
              <div className="mt-2 text-[14px] text-[var(--color-muted)]">{s.label}</div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
