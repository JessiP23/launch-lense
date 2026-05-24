'use client';

import { motion } from 'framer-motion';

const cards = [
  {
    key: 'go',
    title: 'GO',
    subtitle: 'Strong demand signal detected.',
    body: 'CTR exceeded 2% threshold across 2+ angles. Market demand is confirmed. Build the MVP.',
    threshold: 'CTR > 2% on 2+ angles',
    borderColor: '#16a34a',
    bgColor: '#f0fdf4',
    textColor: '#16a34a',
  },
  {
    key: 'iterate',
    title: 'ITERATE',
    subtitle: 'Partial signal — messaging unclear.',
    body: 'One angle hit threshold but the others didn\'t. Refine your headline and run a second test.',
    threshold: '1 angle > 2%, others < 2%',
    borderColor: '#d97706',
    bgColor: '#fffbeb',
    textColor: '#d97706',
  },
  {
    key: 'nogo',
    title: 'NO-GO',
    subtitle: 'No demand signal detected.',
    body: 'CTR below 0.8% across all angles. The market doesn\'t resonate. Pivot before building.',
    threshold: 'CTR < 0.8% across all angles',
    borderColor: '#dc2626',
    bgColor: '#fef2f2',
    textColor: '#dc2626',
  },
] as const;

export function LandingVerdictEngine() {
  return (
    <section id="verdict-engine" className="scroll-mt-20 py-28 px-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="font-['Sora'] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
            Verdict Engine
          </p>
          <h2 className="font-['Sora'] mt-3 text-[clamp(1.875rem,4vw,3rem)] font-bold tracking-[-0.02em] text-[#1a1a1a]">
            Three possible outcomes. One clear next action.
          </h2>
          <p className="font-['Sora'] mt-4 text-[17px] leading-[1.65] text-[#6b7280]">
            Same verdict model whether you test on Google, Meta, LinkedIn, or TikTok. We aggregate CTR, CPC, and
            spend across every angle against fixed thresholds.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c, i) => (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65, delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}
              className="rounded-xl border-t-4 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07),0_2px_6px_rgba(0,0,0,0.04)] transition-all duration-300"
              style={{ borderColor: c.borderColor, backgroundColor: c.bgColor }}
            >
              <div className="font-['DM_Mono'] text-[12px] font-bold uppercase" style={{ color: c.textColor }}>
                {c.title}
              </div>
              <h3 className="font-['Sora'] mt-2 text-[18px] font-semibold text-[#1a1a1a]">{c.subtitle}</h3>
              <p className="font-['Sora'] mt-3 text-[14px] leading-relaxed text-[#6b7280]">{c.body}</p>
              <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.07)]">
                <div className="font-['DM_Mono'] text-[11px] text-[#6b7280]">{c.threshold}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
