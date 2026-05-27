'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const SCORE = 67;
const RING_SIZE = 88;
const STROKE = 5;

function MarketingHealthgateRing() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const radius = (RING_SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (SCORE / 100) * circ;
  const strokeColor = '#d97706';

  return (
    <div ref={ref} className="relative flex shrink-0 items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="-rotate-90">
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          fill="none"
          stroke="rgba(0,0,0,0.07)"
          strokeWidth={STROKE}
        />
        <motion.circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: inView ? offset : circ }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
    </div>
  );
}

const checks = [
  { weight: 'CRITICAL', name: 'Account status active', result: 'PASS' as const },
  { weight: 'HIGH', name: 'Positive billing balance', result: 'PASS' as const },
  { weight: 'HIGH', name: 'No disapproved ads (90d)', result: 'PASS' as const },
  { weight: 'HIGH', name: 'Funding source verified', result: 'FAIL' as const },
  { weight: 'MEDIUM', name: 'Conversion tracking (e.g. pixel / tag)', result: 'PASS' as const },
  { weight: 'MEDIUM', name: 'Two-factor authentication', result: 'PASS' as const },
  { weight: 'MEDIUM', name: 'Domain verified', result: 'FAIL' as const },
  { weight: 'LOW', name: 'Page quality score > 0.5', result: 'PASS' as const },
  { weight: 'HIGH', name: 'Zero policy violations', result: 'PASS' as const },
] as const;

function weightBadge(w: string) {
  const map: Record<string, string> = {
    CRITICAL: 'bg-[#2A1810] text-[#d97706]',
    HIGH: 'bg-[#1A1A18] text-[#6b7280]',
    MEDIUM: 'bg-[#1A1A18] text-[#6b7280]',
    LOW: 'bg-[#1A1A18] text-[#6b7280]',
  };
  return map[w] ?? map.MEDIUM;
}

export function LandingHealthgate() {
  return (
    <section id="healthgate" className="scroll-mt-20 py-28 px-5 sm:px-6">
      <div className="mx-auto max-w-6xl grid items-center gap-16 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="font-['Sora'] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
            Before every launch
          </p>
          <h2 className="font-['Sora'] mt-3 text-[clamp(1.875rem,4vw,2.75rem)] font-bold tracking-[-0.03em] text-[#1a1a1a]">
            Healthgate™ scores your ad account
            <br />
            <span className="text-[#6b7280]">before we spend a dollar.</span>
          </h2>
          <p className="font-['Sora'] mt-5 max-w-md text-[17px] leading-[1.7] text-[#6b7280]">
            A broken ad account wastes every dollar you put in. Healthgate runs 9 weighted checks — billing,
            conversion tracking, policy, domain, 2FA — and blocks any test with a score below 60. Your $500 is protected before a
            single impression fires.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/canvas?panel=accounts"
              className="font-['Sora'] inline-flex h-11 items-center justify-center rounded-full bg-[#111111] px-6 text-[14px] font-semibold text-white transition-opacity hover:opacity-80"
            >
              Check your account
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="rounded-2xl border border-[rgba(0,0,0,0.07)] bg-[#f9f9f8] p-8">
            <div className="flex flex-wrap items-start justify-between gap-6 border-b border-[rgba(0,0,0,0.07)] pb-6">
              <div>
                <div className="font-['DM_Mono'] text-[11px] font-medium uppercase tracking-wide text-[#6b7280]">
                  Account Score
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-['Sora'] text-[3.5rem] font-extrabold leading-none text-[#1a1a1a]">{SCORE}</span>
                  <span className="font-['DM_Mono'] text-[14px] text-[#6b7280]">/100</span>
                </div>
                <p className="font-['DM_Mono'] mt-2 text-[11px] font-bold uppercase tracking-wide text-[#d97706]">
                  WARNING — Launch delayed
                </p>
              </div>
              <MarketingHealthgateRing />
            </div>

            <ul className="divide-y divide-[rgba(0,0,0,0.07)]">
              {checks.map((row) => (
                <li key={row.name} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`font-['DM_Mono'] shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${weightBadge(row.weight)}`}
                    >
                      {row.weight}
                    </span>
                    <span className="font-['Sora'] truncate text-[13px] text-[#1a1a1a]">{row.name}</span>
                  </div>
                  <span
                    className={`font-['DM_Mono'] shrink-0 text-[11px] font-bold uppercase ${
                      row.result === 'PASS' ? 'text-[#16a34a]' : 'text-[#dc2626]'
                    }`}
                  >
                    {row.result}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-xl border border-[rgba(0,0,0,0.07)] bg-[#fffbeb] p-4">
              <p className="font-['Sora'] text-[13px] leading-relaxed text-[#d97706]">
                Fix 2 failing checks to unlock test launch. Estimated fix time: 10 minutes.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
