'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { StatusDot } from '@/components/status-dot';
import { VerdictBadge, type LandingVerdict } from '@/components/landing/verdict-badge';
import { LANDING_EASE } from '@/components/landing/motion-variants';

type Angle = {
  id: string;
  label: string;
  headline: string;
  ctr: string;
  impressions: string;
  verdict: LandingVerdict;
  barHeights: number[];
};

const ANGLES: Angle[] = [
  {
    id: 'A',
    label: 'Angle A',
    headline: 'Ship validation in 48 hours — not 8 weeks.',
    ctr: '2.6%',
    impressions: '18.2k',
    verdict: 'GO',
    barHeights: [
      0.35, 0.52, 0.48, 0.61, 0.55, 0.72, 0.68, 0.75, 0.82, 0.78, 0.88, 0.91, 0.89, 0.94, 0.92, 0.96, 0.93, 0.97, 0.95, 1,
    ],
  },
  {
    id: 'B',
    label: 'Angle B',
    headline: 'Real spend. Real CTR. No survey theater.',
    ctr: '1.1%',
    impressions: '14.8k',
    verdict: 'ITERATE',
    barHeights: [
      0.42, 0.38, 0.45, 0.4, 0.5, 0.47, 0.55, 0.51, 0.58, 0.54, 0.6, 0.57, 0.62, 0.59, 0.64, 0.61, 0.66, 0.63, 0.68, 0.65,
    ],
  },
  {
    id: 'C',
    label: 'Angle C',
    headline: 'Stop building ideas the market ignores.',
    ctr: '0.5%',
    impressions: '11.0k',
    verdict: 'NO-GO',
    barHeights: [
      0.55, 0.48, 0.42, 0.4, 0.38, 0.35, 0.33, 0.3, 0.28, 0.26, 0.25, 0.24, 0.22, 0.21, 0.2, 0.19, 0.18, 0.17, 0.16, 0.15,
    ],
  },
];

function jitter(n: number, amp: number) {
  return Math.max(0, n + (Math.random() * 2 - 1) * amp);
}

export function LiveTestMockup() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.25 });
  const [angleIndex, setAngleIndex] = useState(0);
  const [spend, setSpend] = useState(312.4);
  const [impressions, setImpressions] = useState(55204);
  const [clicks, setClicks] = useState(2840);
  const [ctr, setCtr] = useState(4.3);

  const angle = ANGLES[angleIndex % ANGLES.length];

  useEffect(() => {
    if (!inView) return;
    const id = window.setInterval(() => {
      setAngleIndex((i) => (i + 1) % ANGLES.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [inView]);

  useEffect(() => {
    if (!inView) return;
    const id = window.setInterval(() => {
      setSpend((v) => jitter(v, 1.2));
      setImpressions((v) => Math.round(jitter(v, 120)));
      setClicks((v) => Math.round(jitter(v, 8)));
      setCtr((v) => Number(jitter(v, 0.08).toFixed(1)));
    }, 900);
    return () => window.clearInterval(id);
  }, [inView]);

  const fmtSpend = useMemo(() => spend.toFixed(2), [spend]);
  const fmtImp = useMemo(() => impressions.toLocaleString(), [impressions]);
  const fmtClicks = useMemo(() => clicks.toLocaleString(), [clicks]);

  return (
    <div
      ref={rootRef}
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_2px_16px_rgba(0,0,0,0.06)] overflow-hidden"
    >
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-raised)] px-3 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#C4BFB8]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#C4BFB8]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#C4BFB8]" />
        </div>
        <div className="ml-2 flex min-w-0 flex-1 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1">
          <span className="truncate font-mono text-[10px] text-[var(--color-muted)]">
            launch-lense.vercel.app/tests/tst_9f2a7c
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
          <div>
            <div className="font-mono text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
              Active Test
            </div>
            <div className="mt-1 font-display text-[15px] font-bold tracking-tight text-[var(--color-ink)]">
              Idea: AI compliance copilot
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot status="yellow" pulse className="h-1.5 w-1.5" />
            <span className="font-mono text-[10px] font-bold uppercase text-[var(--color-warn-dark)]">
              LIVE · 22h left
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Spend', value: `$${fmtSpend}`, sub: 'of $500' },
            { label: 'Impressions', value: fmtImp, sub: 'cold traffic' },
            { label: 'Clicks', value: fmtClicks, sub: 'unique' },
            { label: 'Avg CTR', value: `${ctr}%`, sub: 'blended' },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-[var(--color-raised)] bg-[var(--color-raised)] p-3"
            >
              <div className="font-mono text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
                {m.label}
              </div>
              <div className="mt-1 font-display text-[18px] font-bold tabular-nums tracking-tight text-[var(--color-ink)]">
                {m.value}
              </div>
              <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{m.sub}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {ANGLES.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAngleIndex(i)}
              className={
                i === angleIndex
                  ? 'rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-[12px] font-medium text-white'
                  : 'rounded-full bg-[var(--color-raised)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-muted)] transition-colors duration-150 hover:text-[var(--color-ink)]'
              }
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="mt-4 min-h-[140px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={angle.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: LANDING_EASE }}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="font-display text-[16px] font-bold leading-snug tracking-tight text-[var(--color-ink)]">
                {angle.headline}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="font-mono text-[12px] tabular-nums text-[var(--color-muted)]">
                  CTR <span className="text-[var(--color-ink)]">{angle.ctr}</span>
                </div>
                <div className="font-mono text-[12px] tabular-nums text-[var(--color-muted)]">
                  Impr. <span className="text-[var(--color-ink)]">{angle.impressions}</span>
                </div>
                <VerdictBadge verdict={angle.verdict} />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-4 flex h-14 items-end gap-0.5">
          {angle.barHeights.map((h, i) => {
            const tint =
              angle.verdict === 'GO'
                ? 'bg-[var(--color-go)]/40'
                : angle.verdict === 'ITERATE'
                  ? 'bg-[var(--color-warn)]/45'
                  : 'bg-[var(--color-stop)]/40';
            return (
              <motion.div
                key={`${angle.id}-${i}`}
                className={`flex-1 origin-bottom rounded-sm ${tint}`}
                style={{ maxWidth: 14 }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: h }}
                transition={{ duration: 0.35, ease: LANDING_EASE, delay: i * 0.025 }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
