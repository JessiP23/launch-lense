'use client';

import { motion } from 'framer-motion';

const quotes = [
  {
    quote:
      "Killed our 'AI for realtors' idea in 48h. Would've wasted 6 weeks building otherwise. NO-GO verdict was clear — 0.4% CTR across all angles. Painful but correct.",
    name: 'Marcus T.',
    role: 'Founder',
    tag: 'Early access',
    verdict: 'NO-GO',
    initials: 'MT',
  },
  {
    quote:
      'Healthgate caught domain verification before launch. Fixed in 10 min. Without it we\'d have spent $500 and gotten 0 impressions.',
    name: 'Priya S.',
    role: 'Founder, Stealth',
    tag: 'Early access',
    verdict: 'GO',
    initials: 'PS',
  },
  {
    quote:
      'I spend $3k+ per idea on manual tests. If you can get me a real verdict for $549, I\'m in. Just need to see one full PDF report first.',
    name: 'Jordan K.',
    role: 'Founder, Stealth',
    tag: 'Waitlist',
    verdict: 'ITERATE',
    initials: 'JK',
  },
] as const;

export function LandingTestimonials() {
  return (
    <section className="bg-[#f9f9f8] py-28 px-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="font-['Sora'] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
            What founders say
          </p>
          <h2 className="font-['Sora'] mt-3 text-[clamp(1.875rem,4vw,3rem)] font-bold tracking-[-0.02em] text-[#1a1a1a]">
            Founders trust the data.
          </h2>
        </motion.div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {quotes.map((q, i) => (
            <motion.figure
              key={q.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65, delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}
              className="flex h-full flex-col gap-5 rounded-xl border border-[rgba(0,0,0,0.07)] bg-[#ffffff] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07),0_2px_6px_rgba(0,0,0,0.04)] transition-all duration-300"
            >
              <div className="font-['DM_Mono'] text-[11px] font-bold uppercase" style={{
                color: q.verdict === 'GO' ? '#16a34a' : q.verdict === 'NO-GO' ? '#dc2626' : '#d97706'
              }}>
                {q.verdict}
              </div>
              <blockquote className="font-['Sora'] text-[15px] leading-[1.7] text-[#1a1a1a]">
                &ldquo;{q.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-auto border-t border-[rgba(0,0,0,0.07)] pt-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f9f9f8]">
                    <span className="font-['Sora'] text-[14px] font-semibold text-[#1a1a1a]">{q.initials}</span>
                  </div>
                  <div>
                    <div className="font-['Sora'] text-[14px] font-semibold text-[#1a1a1a]">{q.name}</div>
                    <div className="font-['Sora'] mt-0.5 text-[12px] text-[#6b7280]">{q.role}</div>
                  </div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}