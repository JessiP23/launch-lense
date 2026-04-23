'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ScrollReveal } from '@/components/landing/scroll-reveal';
import { LANDING_EASE } from '@/components/landing/motion-variants';
import { cn } from '@/lib/utils';

const items = [
  {
    q: 'What exactly does LaunchLense do?',
    a: 'Genome gives a free, fast go/no-go style preview on your idea. For live proof, we turn the idea into a real campaign (Google, Meta, LinkedIn, or TikTok), measure response across multiple angles, and return a single verdict with metrics and a shareable PDF.',
  },
  {
    q: 'Do I need an ad account?',
    a: 'Not for Genome — run that first with just your idea. For a live $500 test, you connect the ad account for the network you want to use (e.g. Google, Meta, LinkedIn, or TikTok) so spend and delivery stay on your billing. Healthgate™ runs on the account you launch with.',
  },
  {
    q: 'What is Healthgate™?',
    a: 'Healthgate™ is a weighted, 9-check scan of the ad account you connect — billing, conversion tracking, policy risk, domain, 2FA, and more. If your score is below 60, we block launch until you fix the failures.',
  },
  {
    q: 'Is the $500 ad spend included in the price?',
    a: 'No. The $500 media test is charged by the ad platform (Google, Meta, LinkedIn, or TikTok) to your account. Genome is free. LaunchLense’s fee covers live tests: angles, pages, orchestration, verdict, and reporting.',
  },
  {
    q: 'How accurate are the verdicts?',
    a: 'Verdicts are rule-based against CTR and spend thresholds across angles, not vibes. They apply the same way across Google, Meta, LinkedIn, and TikTok. Accuracy depends on account health and traffic quality — which is why Healthgate™ and cold-audience discipline matter.',
  },
  {
    q: 'What is Genome?',
    a: 'Genome is our free, up-front pass on your idea: fast research, structured scoring, and a clear signal to stop, tweak, or commit to a paid test. It does not replace live ads — it tells you if you are ready to fund them.',
  },
] as const;

export function LandingFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 bg-[var(--color-canvas)] py-28">
      <div className="mx-auto max-w-2xl px-5 sm:px-6">
        <ScrollReveal className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">FAQ</p>
          <h2 className="mt-3 font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold tracking-[-0.03em] text-[var(--color-ink)]">
            Everything you need to know.
          </h2>
        </ScrollReveal>

        <div className="mt-12 space-y-2">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <ScrollReveal key={item.q} delay={i * 0.05}>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 sm:px-5">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 py-4 text-left"
                  >
                    <span className="font-display text-[15px] font-semibold text-[var(--color-ink)]">{item.q}</span>
                    <motion.span
                      aria-hidden
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] text-[18px] leading-none text-[var(--color-muted)]"
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.2, ease: LANDING_EASE }}
                    >
                      +
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: LANDING_EASE }}
                        className="overflow-hidden"
                      >
                        <p className={cn('pb-4 text-[15px] leading-[1.7] text-[var(--color-muted)]')}>{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
