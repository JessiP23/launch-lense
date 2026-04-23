'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ScrollReveal } from '@/components/landing/scroll-reveal';

const SCORE = 67;
const RING_SIZE = 88;
const STROKE = 5;

function MarketingHealthgateRing() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const radius = (RING_SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (SCORE / 100) * circ;
  const strokeColor = 'var(--color-warn-dark)';

  return (
    <div ref={ref} className="relative flex shrink-0 items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="-rotate-90">
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          fill="none"
          stroke="var(--color-dark-border)"
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
    CRITICAL: 'bg-[#2A1810] text-[var(--color-warn-dark)]',
    HIGH: 'bg-[#1A1A18] text-[var(--color-dark-muted)]',
    MEDIUM: 'bg-[#1A1A18] text-[var(--color-dark-muted)]',
    LOW: 'bg-[#1A1A18] text-[var(--color-dark-muted)]',
  };
  return map[w] ?? map.MEDIUM;
}

export function LandingHealthgateBlock() {
  return (
    <section id="healthgate" className="scroll-mt-20 bg-[#111110] py-28 text-[var(--color-dark-text)]">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 sm:px-6 lg:grid-cols-2">
        <ScrollReveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-dark-muted)]">
            Before every launch
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold tracking-[-0.03em] text-white">
            Healthgate™ scores your ad account
            <br />
            <span className="text-[var(--color-dark-muted)]">before we spend a dollar.</span>
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-[1.7] text-[var(--color-dark-muted)]">
            A broken ad account wastes every dollar you put in. Healthgate runs 9 weighted checks — billing,
            conversion tracking, policy, domain, 2FA — and blocks any test with a score below 60. Your $500 is protected before a
            single impression fires.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/accounts/connect"
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-[14px] font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-raised)]"
            >
              Check your account
            </Link>
            <a
              href="#faq"
              className="text-[14px] text-[var(--color-dark-muted)] underline-offset-4 transition-opacity hover:opacity-80"
            >
              See scoring formula
            </a>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.08}>
          <div className="rounded-2xl border border-[#2A2A28] bg-[#1A1A18] p-8">
            <div className="flex flex-wrap items-start justify-between gap-6 border-b border-[#2A2A28] pb-6">
              <div>
                <div className="font-mono text-[11px] font-medium uppercase tracking-wide text-[var(--color-dark-muted)]">
                  Account Score
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-display text-[3.5rem] font-extrabold leading-none text-white">{SCORE}</span>
                  <span className="font-mono text-[14px] text-[var(--color-dark-muted)]">/100</span>
                </div>
                <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--color-warn-dark)]">
                  WARNING — Launch delayed
                </p>
              </div>
              <MarketingHealthgateRing />
            </div>

            <ul className="divide-y divide-[#2A2A28]">
              {checks.map((row) => (
                <li key={row.name} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide ${weightBadge(row.weight)}`}
                    >
                      {row.weight}
                    </span>
                    <span className="truncate text-[13px] text-[var(--color-dark-text)]">{row.name}</span>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-[11px] font-bold uppercase ${
                      row.result === 'PASS' ? 'text-[var(--color-go-dark)]' : 'text-[var(--color-stop-dark)]'
                    }`}
                  >
                    {row.result}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-xl border border-[#3D2800] bg-[#1C1500] p-4">
              <p className="text-[13px] leading-relaxed text-[var(--color-warn-dark)]">
                Fix 2 failing checks to unlock test launch. Estimated fix time: 10 minutes.
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
