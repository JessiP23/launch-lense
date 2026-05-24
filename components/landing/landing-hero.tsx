'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export function LandingHero() {
  return (
    <section className="pt-32 pb-20 px-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex"
        >
          <span className="font-['Sora'] inline-flex items-center rounded-full border border-[rgba(0,0,0,0.07)] bg-[#f9f9f8] px-4 py-2 text-[12px] font-medium text-[#6b7280]">
            Validate with real ad data — not surveys
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="font-['Sora'] mt-8 text-[clamp(44px,7vw,84px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-[#1a1a1a]"
        >
          Kill bad startup ideas before they kill your time.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-['Sora'] mt-6 max-w-2xl text-[17px] leading-[1.65] text-[#6b7280]"
        >
          Run a real $500 ad test on Google, Meta, LinkedIn, or TikTok. Get a GO / NO-GO / ITERATE verdict in 48 hours. No surveys. No guesswork.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 flex flex-wrap gap-4"
        >
          <Link
            href="/canvas"
            className="font-['Sora'] inline-flex h-12 items-center justify-center rounded-full bg-[#111111] px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-80"
          >
            Start validating
          </Link>
          <Link
            href="#how-it-works"
            className="font-['Sora'] inline-flex h-12 items-center justify-center rounded-full border border-[rgba(0,0,0,0.07)] px-7 text-[15px] font-semibold text-[#1a1a1a] transition-colors hover:bg-[rgba(0,0,0,0.04)]"
          >
            How it works
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8"
        >
          <span className="font-['Sora'] inline-flex items-center rounded-full border border-[rgba(0,0,0,0.07)] bg-[#f9f9f8] px-4 py-2 text-[12px] text-[#6b7280]">
            Upcoming on Product Hunt
          </span>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 flex flex-wrap items-center gap-0 border-t border-[rgba(0,0,0,0.07)] pt-8"
        >
          {[
            { label: '48h', desc: 'Average verdict time' },
            { label: '94%', desc: 'Verdict accuracy' },
            { label: '$500', desc: 'Max budget' },
            { label: '4', desc: 'Channels supported' },
          ].map((stat, i) => (
            <div key={i} className="flex items-center gap-6">
              <div>
                <div className="font-['DM_Mono'] text-[28px] font-bold text-[#1a1a1a]">{stat.label}</div>
                <div className="font-['Sora'] text-[13px] text-[#6b7280]">{stat.desc}</div>
              </div>
              {i < 3 && <div className="h-8 w-px bg-[rgba(0,0,0,0.07)]" />}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
