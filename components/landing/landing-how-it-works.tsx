'use client';

import { motion } from 'framer-motion';

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
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-[#f9f9f8] py-28 px-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="font-['Sora'] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">Process</p>
          <h2 className="font-['Sora'] mt-3 text-[clamp(1.875rem,4vw,3rem)] font-bold tracking-[-0.02em] text-[#1a1a1a]">
            From idea to verdict in 4 steps.
          </h2>
          <p className="font-['Sora'] mt-4 text-[17px] leading-[1.65] text-[#6b7280]">
            No surveys. No assumptions. Real people, real clicks, real data.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65, delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-[#ffffff] p-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#111111]">
                <span className="font-['DM_Mono'] text-[24px] font-bold text-[#ffffff]">{s.n}</span>
              </div>
              <h3 className="font-['Sora'] mt-4 text-[18px] font-semibold text-[#1a1a1a]">{s.title}</h3>
              <p className="font-['Sora'] mt-3 text-[14px] leading-relaxed text-[#6b7280]">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}