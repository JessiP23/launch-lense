'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

const steps = [
  {
    n: '01',
    title: 'Connect your ad account(s)',
    body: 'Link Google, Meta, LinkedIn, and/or TikTok via OAuth. Healthgate™ scans the account you launch with and flags issues before a dollar moves.',
  },
  {
    n: '02',
    title: 'Describe your startup idea',
    body: 'Optional: run Genome first for a first, fast preview. Then write your idea in plain English — we generate 3 ad angles (headline, body, CTA) per value prop.',
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
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.8', 'end 0.2']
  });

  // Line draws from 0 to 100% as you scroll through the section
  const lineHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <section id="how-it-works" className="scroll-mt-20 bg-[var(--color-canvas)] py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text- font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">Process</p>
          <h2 className="mt-3 font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold tracking-[-0.03em] text-[var(--color-ink)]">
            From idea to verdict in 4 steps.
          </h2>
          <p className="mt-4 text- leading-[1.65] text-[var(--color-muted)]">
            No surveys. No assumptions. Real people, real clicks, real data.
          </p>
        </div>

        <div ref={containerRef} className="relative mt-16">
          {/* Static rail */}
          <div className="absolute left- top-2 hidden h-[calc(100%-16px)] w-px bg-[var(--color-border)] lg:block" aria-hidden />

          {/* Animated progress rail — draws as you scroll. This is the unique bit */}
          <motion.div
            className="absolute left- top-2 hidden w-px origin-top bg-[var(--color-ink)] lg:block"
            style={{ height: lineHeight }}
            aria-hidden
          />

          <div className="grid gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
                className="group relative grid gap-6 will-change-transform lg:grid-cols-[32px_1fr] lg:items-start"
              >
                {/* Number node — fills when line passes it */}
                <motion.div
                  className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-[var(--color-canvas)] transition-colors duration-300"
                  style={{
                    borderColor: useTransform(
                      scrollYProgress,
                      [i * 0.25, (i + 0.5) * 0.25],
                      ['var(--color-border)', 'var(--color-ink)']
                    )
                  }}
                >
                  <span className="font-mono text- font-bold text-[var(--color-ink)]">
                    {s.n}
                  </span>
                </motion.div>

                {/* Content — no hover scale, just border color. Smooth. */}
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 transition-colors duration-200 lg:-mt-1">
                  <h3 className="font-display text- font-bold tracking-tight text-[var(--color-ink)]">
                    {s.title}
                  </h3>
                  <p className="mt-3 text- leading-[1.7] text-[var(--color-muted)]">
                    {s.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}