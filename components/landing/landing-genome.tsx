'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export function LandingGenome() {
  return (
    <section id="genome" className="scroll-mt-20 py-28 px-5 sm:px-6">
      <div className="mx-auto max-w-6xl grid items-center gap-16 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="font-['Sora'] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
            Before you buy ads
          </p>
          <h2 className="font-['Sora'] mt-3 text-[clamp(1.875rem,4vw,3rem)] font-bold tracking-[-0.02em] text-[#1a1a1a]">
            Genome — a go / no-go on your idea.
          </h2>
          <p className="font-['Sora'] mt-4 text-[17px] leading-[1.7] text-[#6b7280]">
            Paste your idea and get a fast, research-backed preview: market signals, risks, and a clear signal
            to pivot or proceed — before you connect an ad account or spend your test budget.
          </p>
          <div className="mt-8">
            <Link
              href="/canvas?new=1"
              className="font-['Sora'] inline-flex h-12 items-center justify-center rounded-full border border-[rgba(0,0,0,0.07)] bg-[#ffffff] px-7 text-[15px] font-semibold text-[#1a1a1a] transition-colors hover:bg-[rgba(0,0,0,0.04)]"
            >
              Run Genome →
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-4"
        >
          {[
            { title: 'Live research hooks', desc: 'Uses live research hooks + structured scoring — not a generic chat blurb.' },
            { title: 'Pairs with live tests', desc: 'Genome → Healthgate™ → $500 run across the channels you use.' },
            { title: '3 ad angles', desc: 'Headline, body, CTA variants generated automatically for each value prop.' },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65, delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-[#f9f9f8] p-6"
            >
              <h3 className="font-['Sora'] text-[15px] font-semibold text-[#1a1a1a]">{feature.title}</h3>
              <p className="font-['Sora'] mt-2 text-[14px] leading-relaxed text-[#6b7280]">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
