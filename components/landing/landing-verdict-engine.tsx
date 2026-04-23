'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ScrollReveal } from '@/components/landing/scroll-reveal';
import { LANDING_EASE } from '@/components/landing/motion-variants';

const cards = [
  {
    key: 'go',
    title: 'GO',
    subtitle: 'Strong demand signal detected.',
    body: 'CTR exceeded 2% threshold across 2+ angles. Market demand is confirmed. Build the MVP.',
    className:
      'border border-[var(--color-go-border)] bg-[var(--color-go-bg)] hover:border-2 hover:border-[var(--color-go)]',
    titleClass: 'text-[var(--color-go)]',
    subtitleClass: 'text-[var(--color-go)]',
    bodyClass: 'text-[#065f46]',
  },
  {
    key: 'iterate',
    title: 'ITERATE',
    subtitle: 'Partial signal — messaging unclear.',
    body: 'One angle hit threshold but the others didn\'t. Refine your headline and run a second test.',
    className:
      'border border-[var(--color-warn-border)] bg-[var(--color-warn-bg)] hover:border-[var(--color-warn-border)]',
    titleClass: 'text-[var(--color-warn)]',
    subtitleClass: 'text-[var(--color-warn)]',
    bodyClass: 'text-[#92400e]',
  },
  {
    key: 'nogo',
    title: 'NO-GO',
    subtitle: 'No demand signal detected.',
    body: 'CTR below 0.8% across all angles. The market doesn\'t resonate. Pivot before building.',
    className:
      'border border-[var(--color-stop-border)] bg-[var(--color-stop-bg)] hover:border-[var(--color-stop-border)]',
    titleClass: 'text-[var(--color-stop)]',
    subtitleClass: 'text-[var(--color-stop)]',
    bodyClass: 'text-[#991b1b]',
  },
] as const;

export function LandingVerdictEngine() {
  return (
    <section id="verdict-engine" className="scroll-mt-20 border-y border-[var(--color-border)] bg-[var(--color-surface)] py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 sm:px-6 lg:grid-cols-2">
        <ScrollReveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
            Verdict Engine
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold tracking-[-0.03em]">
            <span className="text-[var(--color-ink)]">Three possible outcomes.</span>
            <br />
            <span className="text-[var(--color-muted)]">One clear next action.</span>
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-[1.7] text-[var(--color-muted)]">
            Same verdict model whether you test on Google, Meta, LinkedIn, or TikTok. We aggregate CTR, CPC, and
            spend across every angle against fixed thresholds — plus Genome upstream when you want a no-spend
            read first. You get one verdict, not a wall of charts, and an angle-by-angle PDF.
          </p>
        </ScrollReveal>

        <div className="flex flex-col gap-4">
          {cards.map((c, i) => (
            <ScrollReveal key={c.key} delay={0.1 * i}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.18, ease: LANDING_EASE }}
                className={`rounded-2xl p-6 transition-[border-width] duration-200 ${c.className}`}
              >
                <div className={`font-display text-[2rem] font-extrabold ${c.titleClass}`}>{c.title}</div>
                <p className={`mt-1 font-display text-[14px] font-medium ${c.subtitleClass}`}>{c.subtitle}</p>
                <p className={`mt-3 text-[13px] leading-relaxed ${c.bodyClass}`}>{c.body}</p>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
