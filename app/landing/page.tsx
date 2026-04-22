'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

function FadeUp({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#111110]">

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="border-b border-[#E8E4DC] bg-[#FAFAF8]">
        <div className="max-w-[1120px] mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-display text-[1.0625rem] font-bold tracking-tight text-[#111110]">
            LaunchLense
          </span>
          <div className="flex items-center gap-7">
            <a href="#how" className="text-[0.875rem] text-[#8C8880] hover:text-[#111110] transition-colors">
              How it works
            </a>
            <a href="#pricing" className="text-[0.875rem] text-[#8C8880] hover:text-[#111110] transition-colors">
              Pricing
            </a>
            <button
              onClick={() => router.push('/accounts/connect')}
              className="h-9 px-[22px] rounded-full bg-[#111110] text-white text-[0.875rem] font-medium hover:bg-[#111110]/90 transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="pt-[120px] pb-20 text-center">
        <div className="max-w-[680px] mx-auto px-6 space-y-6">
          <FadeUp delay={0}>
            <p className="text-[0.8125rem] font-medium uppercase tracking-[0.06em] text-[#8C8880]">
              Startup Validation · Powered by Real Ad Data
            </p>
          </FadeUp>

          <FadeUp delay={0.08}>
            <h1 className="font-display text-[3rem] font-extrabold leading-[1.1] tracking-[-0.04em]">
              <span className="text-[#111110]">Kill bad startup ideas</span>
              <br />
              <span className="text-[#8C8880]">before they kill your time.</span>
            </h1>
          </FadeUp>

          <FadeUp delay={0.16}>
            <p className="text-[1.0625rem] text-[#8C8880] leading-relaxed max-w-[480px] mx-auto">
              Run a real $500 Meta ad test. Get a GO / NO-GO verdict in 48 hours.
              No surveys. No assumptions. Just data.
            </p>
          </FadeUp>

          <FadeUp delay={0.24}>
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => router.push('/accounts/connect')}
                className="h-11 px-8 rounded-full bg-[#111110] text-white text-[0.9375rem] font-medium hover:bg-[#111110]/90 transition-colors"
              >
                Start Validating
              </button>
              <button
                onClick={() => router.push('/share/demo')}
                className="text-[0.9375rem] text-[#8C8880] hover:text-[#111110] underline underline-offset-4 transition-colors"
              >
                See Sample Report →
              </button>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Social Proof Bar ─────────────────────────────────────────── */}
      <section className="max-w-[860px] mx-auto px-6 mt-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="bg-[#FFFFFF] border border-[#E8E4DC] rounded-[12px] grid grid-cols-3 divide-x divide-[#E8E4DC]"
        >
          {[
            { num: '2,500+', label: 'Ideas Validated' },
            { num: '$1.2M',  label: 'Ad Spend Managed' },
            { num: '48h',    label: 'Average Turnaround' },
          ].map(({ num, label }) => (
            <div key={label} className="py-10 text-center">
              <div className="font-display text-[2.25rem] font-extrabold text-[#111110] leading-none">
                {num}
              </div>
              <div className="text-[0.875rem] text-[#8C8880] mt-2">{label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────── */}
      <section id="how" className="max-w-[1120px] mx-auto px-6 mt-32">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[#8C8880]">
          Process
        </p>
        <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.03em] text-[#111110] mt-3">
          Four steps. Forty-eight hours.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
          {[
            { n: '01', title: 'Connect your Meta ad account', desc: 'Link your account in 60 seconds. We run a Healthgate™ score before touching a dollar.' },
            { n: '02', title: 'Describe your startup idea',   desc: 'One paragraph is enough. Our AI decomposes it into buyer intent, keywords, and angles.' },
            { n: '03', title: 'We build and launch a real ad', desc: 'Copy, creative, targeting, landing page — assembled and live on Meta within minutes.' },
            { n: '04', title: 'Get your GO / NO-GO verdict',  desc: 'After 48 hours of real traffic, you get a data-backed verdict and a full PDF report.' },
          ].map(({ n, title, desc }) => (
            <div key={n} className="bg-[#FFFFFF] border border-[#E8E4DC] rounded-[16px] p-8">
              <div className="font-display text-[2.5rem] font-extrabold text-[#F3F0EB] leading-none select-none">
                {n}
              </div>
              <div className="font-display text-[1rem] font-bold text-[#111110] mt-4 leading-snug">
                {title}
              </div>
              <div className="text-[0.875rem] text-[#8C8880] mt-2 leading-[1.7]">
                {desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Healthgate™ Callout ───────────────────────────────────────── */}
      <section className="max-w-[1120px] mx-auto px-6 mt-32">
        <div className="bg-[#111110] rounded-[20px] p-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.03em] text-white leading-snug">
              Healthgate™ — Your Ad Account, Scored.
            </h2>
            <p className="text-[0.9375rem] text-[#8C8880] mt-4 leading-relaxed">
              Before every test, we score your Meta account 0–100.
              Bad account? We block the launch and protect your $500.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center">
            {/* Mock score ring */}
            <div className="relative w-32 h-32">
              <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
                <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                <circle
                  cx="64" cy="64" r="54"
                  fill="none"
                  stroke="#059669"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 54}`}
                  strokeDashoffset={`${2 * Math.PI * 54 * (1 - 0.87)}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-[2.75rem] font-extrabold text-white leading-none">87</span>
              </div>
            </div>
            <span className="text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[#059669] mt-3">
              Healthy
            </span>
          </div>
        </div>
      </section>

      {/* ── Verdict Engine ───────────────────────────────────────────── */}
      <section className="max-w-[1120px] mx-auto px-6 mt-32">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[#8C8880]">
          Verdict Engine
        </p>
        <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.03em] text-[#111110] mt-3">
          One of three outcomes. Always clear.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[16px] p-6">
            <div className="font-display text-[1.5rem] font-extrabold text-[#059669]">GO</div>
            <p className="text-[0.875rem] text-[#8C8880] mt-2 leading-[1.7]">
              Strong search intent, manageable competition, validated language–market fit. Build it.
            </p>
          </div>
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[16px] p-6">
            <div className="font-display text-[1.5rem] font-extrabold text-[#D97706]">ITERATE</div>
            <p className="text-[0.875rem] text-[#8C8880] mt-2 leading-[1.7]">
              Mixed signals. A pivot in positioning or audience could unlock the market.
            </p>
          </div>
          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[16px] p-6">
            <div className="font-display text-[1.5rem] font-extrabold text-[#DC2626]">NO-GO</div>
            <p className="text-[0.875rem] text-[#8C8880] mt-2 leading-[1.7]">
              Low demand, oversaturated, or poor language fit. You saved $35k on a bad MVP.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="mt-32">
        <div className="bg-[#F3F0EB] py-20 text-center px-6">
          <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.03em] text-[#111110]">
            Ready to validate in 48 hours?
          </h2>
          <p className="text-[0.9375rem] text-[#8C8880] mt-3 max-w-[400px] mx-auto leading-relaxed">
            One test. One verdict. Under $500.
          </p>
          <button
            onClick={() => router.push('/accounts/connect')}
            className="mt-8 h-11 px-8 rounded-full bg-[#111110] text-white text-[0.9375rem] font-medium hover:bg-[#111110]/90 transition-colors"
          >
            Start Validating
          </button>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-[#E8E4DC] py-8">
        <div className="max-w-[1120px] mx-auto px-6 flex items-center justify-between">
          <span className="font-display text-[0.875rem] font-bold text-[#111110]">LaunchLense</span>
          <span className="text-[0.8125rem] text-[#8C8880]">© 2026 LaunchLense</span>
        </div>
      </footer>

    </div>
  );
}
