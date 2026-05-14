'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { StatusDot } from '@/components/status-dot';
import { LiveTestMockup } from '@/components/landing/live-test-mockup';
import { LANDING_EASE, staggerShow } from '@/components/landing/motion-variants';
import Image from 'next/image';

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
            Start with Genome, a $15 go/no-go check in 60 seconds. Then run a real $500 ad tests on Meta, Google, LinkedIn, or TikTok and get a GO / NO-GO / ITERATE verdict in 48 hours.
          </motion.p>

          <motion.div variants={heroItem} className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/canvas"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--color-ink)] px-7 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-[#2a2a28]"
            >
              Start validating
            </Link>
          </motion.div>

          <motion.div variants={heroItem} className="mt-8">
            <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] text-[var(--color-muted)]">
              Upcoming on Product Hunt
            </span>
          </motion.div>
        </motion.div>

        <motion.div
          className="relative w-full overflow-visible"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: LANDING_EASE, delay: 0.12 }}
        >
          {/* Cap the image so it never overflows the column on tablets.
              On desktop we still let it bleed slightly to the right for the
              hero composition, but using max-width instead of a fixed 220%
              that breaks on mid-width screens. */}
          <img
            src="/image.png"
            alt="LaunchLense product preview"
            className="block w-full max-w-[640px] h-auto mx-auto lg:max-w-none lg:w-[120%] lg:-translate-y-2"
            loading="eager"
            decoding="async"
          />
        </motion.div>
      </div>
    </section>
  );
}
