'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ScrollReveal } from '@/components/landing/scroll-reveal';
import { LANDING_EASE } from '@/components/landing/motion-variants';

const plans = [
  {
    name: 'Starter',
    price: '$49',
    unit: '/ per test',
    features: ['Genome (free)', '1 test', '3 angles', 'Healthgate™', '48h verdict', 'PDF report'],
    cta: 'Run one test',
    href: '/accounts/connect',
    highlight: false,
  },
  {
    name: 'Studio',
    price: '$199',
    unit: '/ per month',
    features: [
      'Genome (free)',
      'Unlimited tests',
      'Unlimited angles',
      'Priority Healthgate sync',
      'PDF reports + share links',
      'Team access',
      'Benchmark comparisons',
    ],
    cta: 'Start Studio plan',
    href: '/accounts/connect',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    unit: 'pricing',
    features: [
      'Everything in Studio',
      'Custom verdict logic',
      'API access',
      'Dedicated support',
      'SLA',
      'White-label reports',
    ],
    cta: 'Talk to us',
    href: '#final-cta',
    highlight: false,
  },
] as const;

export function LandingPricing() {
  return (
    <section id="pricing" className="scroll-mt-20 border-y border-[var(--color-border)] bg-[var(--color-surface)] py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">Pricing</p>
          <h2 className="mt-3 font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold tracking-[-0.03em] text-[var(--color-ink)]">
            Pay for what you need.
          </h2>
          <p className="mt-4 text-[15px] leading-[1.65] text-[var(--color-muted)]">
            Ad spend ($500/test) is charged by the network you use (Google, Meta, LinkedIn, or TikTok) to your ad account. Our fee covers the platform. Genome is free.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {plans.map((p, i) => (
            <ScrollReveal key={p.name} delay={i * 0.08}>
              {p.highlight ? (
                <div className="flex h-full flex-col rounded-2xl border border-[#111110] bg-[#111110] p-8 text-white">
                  <div className="font-display text-[13px] font-semibold uppercase tracking-wide text-[var(--color-dark-muted)]">
                    {p.name}
                  </div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-[2.75rem] font-extrabold leading-none">{p.price}</span>
                    <span className="text-[14px] text-[var(--color-dark-muted)]">{p.unit}</span>
                  </div>
                  <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-[14px] text-[var(--color-dark-muted)]">
                    {p.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <Link
                    href={p.href}
                    className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-white text-[14px] font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-raised)]"
                  >
                    {p.cta}
                  </Link>
                </div>
              ) : (
                <motion.div
                  className="flex h-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8"
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2, ease: LANDING_EASE }}
                >
                  <div className="font-display text-[13px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    {p.name}
                  </div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-[2.75rem] font-extrabold leading-none text-[var(--color-ink)]">
                      {p.price}
                    </span>
                    <span className="text-[14px] text-[var(--color-muted)]">{p.unit}</span>
                  </div>
                  <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-[14px] text-[var(--color-muted)]">
                    {p.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <Link
                    href={p.href}
                    className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-[var(--color-ink)] text-[14px] font-semibold text-white transition-colors hover:bg-[#2a2a28]"
                  >
                    {p.cta}
                  </Link>
                </motion.div>
              )}
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
