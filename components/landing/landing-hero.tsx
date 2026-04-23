'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { StatusDot } from '@/components/status-dot';
import { LiveTestMockup } from '@/components/landing/live-test-mockup';
import { LANDING_EASE, staggerShow } from '@/components/landing/motion-variants';

const heroContainer = staggerShow(0.09);

const heroItem = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: LANDING_EASE },
  },
};

export function LandingHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const yCol = useTransform(scrollY, [0, 520], [0, 60]);

  return (
    <section ref={sectionRef} className="relative pt-[100px] pb-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `linear-gradient(to right, var(--color-border) 1px, transparent 1px),
            linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 70% 65% at 50% 45%, black 20%, transparent 75%)',
        }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
        <motion.div style={{ y: yCol }} variants={heroContainer} initial="hidden" animate="show">
          <motion.div variants={heroItem} className="inline-flex">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5">
              <StatusDot status="green" pulse className="h-1.5 w-1.5" />
              <span className="text-[11px] font-medium text-[var(--color-muted)]">
                Validate with real ad data (Google, Meta, LinkedIn, TikTok) — not surveys
              </span>
            </span>
          </motion.div>

          <motion.h1
            variants={heroItem}
            className="mt-6 font-display text-[clamp(2.5rem,5.5vw,4rem)] font-extrabold leading-[1.06] tracking-[-0.04em] text-[var(--color-ink)]"
          >
            Kill bad startup ideas
            <br />
            <span className="text-[var(--color-muted)]">before they kill</span>
            <br />
            <span className="text-[var(--color-muted)]">your time.</span>
          </motion.h1>

          <motion.p
            variants={heroItem}
            className="mt-5 max-w-lg text-[17px] leading-[1.65] text-[var(--color-muted)]"
          >
            Use Genome for a free preview, then run a real $500 ad test on Google, Meta, LinkedIn, or TikTok and
            get a GO / NO-GO / ITERATE verdict in 48 hours. Stop building what nobody wants.
          </motion.p>

          <motion.div variants={heroItem} className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/accounts/connect"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-ink)] px-7 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-[#2a2a28]"
            >
              Start validating
            </Link>
          </motion.div>

          <motion.div variants={heroItem} className="mt-8 flex flex-wrap items-center gap-5">
            <div className="flex items-center">
              {['#7C6CF9', '#22C55E', '#F59E0B', '#38BDF8'].map((c, i) => (
                <span
                  key={c}
                  className="h-7 w-7 rounded-full border-2 border-[var(--color-surface)]"
                  style={{ backgroundColor: c, marginLeft: i ? -8 : 0 }}
                />
              ))}
              <span className="ml-3 text-[12px] text-[var(--color-muted)]">2,500+ founders</span>
            </div>
            <span className="hidden h-4 w-px bg-[var(--color-border)] sm:block" aria-hidden />
            <div className="flex items-center gap-2">
              <span className="font-display text-[14px] font-bold text-[var(--color-ink)]">4.8</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="h-2.5 w-2.5 rounded-[2px] bg-amber-400" />
                ))}
              </div>
              <span className="text-[12px] text-[var(--color-muted)]">on Product Hunt</span>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: LANDING_EASE, delay: 0.12 }}
        >
          <LiveTestMockup />
        </motion.div>
      </div>
    </section>
  );
}
