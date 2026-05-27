'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export function LandingFinalCta() {
  return (
    <section id="final-cta" className="scroll-mt-20 py-28 px-5 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-3xl bg-[#111111] p-12 text-center"
        >
          <h2 className="font-['Sora'] text-[clamp(1.875rem,4vw,3rem)] font-bold tracking-[-0.02em] text-[#ffffff]">
            Stop guessing. Start knowing.
          </h2>
          <p className="font-['Sora'] mt-4 text-[17px] leading-[1.65] text-[#ffffff]/80">
            Your next startup idea deserves a real market signal — not a survey, not a mock landing page, not a gut feeling. Get the data.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/canvas?panel=accounts"
              className="font-['Sora'] inline-flex h-12 items-center justify-center rounded-full bg-[#ffffff] px-7 text-[15px] font-semibold text-[#111111] transition-opacity hover:opacity-80"
            >
              Start validating
            </Link>
            <Link
              href="#how-it-works"
              className="font-['Sora'] inline-flex h-12 items-center justify-center rounded-full border border-[#ffffff]/30 px-7 text-[15px] font-semibold text-[#ffffff] transition-colors hover:bg-[#ffffff]/10"
            >
              How it works
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
