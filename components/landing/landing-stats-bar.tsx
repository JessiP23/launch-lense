'use client';

import { ScrollReveal } from '@/components/landing/scroll-reveal';

const stats = [
  { value: '2,500+', label: 'Ideas validated' },
  { value: '$1.2M', label: 'Ad spend managed' },
  { value: '48h', label: 'Average verdict time' },
  { value: '94%', label: 'Verdict accuracy rate' },
] as const;

export function LandingStatsBar() {
  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)] py-14">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid grid-cols-2 gap-y-10 md:grid-cols-4 md:gap-y-0 md:divide-x md:divide-[var(--color-border)]">
          {stats.map((s, i) => (
            <ScrollReveal key={s.label} delay={i * 0.06} className="text-center md:px-4">
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
