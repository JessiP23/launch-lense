'use client';

import { motion } from 'framer-motion';

export function LandingDashboardMock() {
  return (
    <section className="py-20 px-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-[#ffffff] shadow-[0_20px_60px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.04)] overflow-hidden"
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-2 border-b border-[rgba(0,0,0,0.07)] px-4 py-3">
            <div className="flex gap-2">
              <div className="h-3 w-3 rounded-full bg-[#ef4444]" />
              <div className="h-3 w-3 rounded-full bg-[#f59e0b]" />
              <div className="h-3 w-3 rounded-full bg-[#22c55e]" />
            </div>
            <div className="ml-4 flex-1 rounded-md bg-[rgba(0,0,0,0.04)] px-3 py-1.5">
              <span className="font-['DM_Mono'] text-[11px] text-[#6b7280]">app.launchlense.io/dashboard</span>
            </div>
          </div>

          {/* Dashboard content */}
          <div className="p-6">
            {/* Metrics row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
              <div className="rounded-lg border border-[rgba(0,0,0,0.07)] bg-[#f9f9f8] p-4">
                <div className="font-['Sora'] text-[12px] font-medium text-[#6b7280] mb-1">CTR</div>
                <div className="font-['DM_Mono'] text-[20px] font-semibold text-[#1a1a1a]">2.4%</div>
              </div>
              <div className="rounded-lg border border-[rgba(0,0,0,0.07)] bg-[#f9f9f8] p-4">
                <div className="font-['Sora'] text-[12px] font-medium text-[#6b7280] mb-1">CPC</div>
                <div className="font-['DM_Mono'] text-[20px] font-semibold text-[#1a1a1a]">$1.42</div>
              </div>
              <div className="rounded-lg border border-[rgba(0,0,0,0.07)] bg-[#f9f9f8] p-4">
                <div className="font-['Sora'] text-[12px] font-medium text-[#6b7280] mb-1">Spend</div>
                <div className="font-['DM_Mono'] text-[20px] font-semibold text-[#1a1a1a]">$487</div>
              </div>
              <div className="rounded-lg border border-[rgba(0,0,0,0.07)] bg-[#f0fdf4] p-4">
                <div className="font-['Sora'] text-[12px] font-medium text-[#6b7280] mb-1">Verdict</div>
                <div className="font-['DM_Mono'] text-[20px] font-semibold text-[#16a34a]">GO</div>
              </div>
            </div>

            {/* Bar chart */}
            <div className="mb-6 rounded-lg border border-[rgba(0,0,0,0.07)] bg-[#f9f9f8] p-4">
              <div className="font-['Sora'] text-[12px] font-medium text-[#6b7280] mb-3">Angle Performance</div>
              <div className="space-y-3">
                {[
                  { label: 'Angle A', value: 85, color: '#16a34a' },
                  { label: 'Angle B', value: 72, color: '#16a34a' },
                  { label: 'Angle C', value: 45, color: '#d97706' },
                ].map((bar, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="font-['Sora'] text-[12px] text-[#1a1a1a] w-16">{bar.label}</div>
                    <div className="flex-1 h-6 rounded bg-[rgba(0,0,0,0.04)] overflow-hidden">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                        style={{ transformOrigin: 'left', backgroundColor: bar.color }}
                        className="h-full rounded"
                      />
                    </div>
                    <div className="font-['DM_Mono'] text-[12px] text-[#6b7280] w-8">{bar.value}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Healthgate score */}
            <div className="rounded-lg border border-[rgba(0,0,0,0.07)] bg-[#f9f9f8] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-['Sora'] text-[12px] font-medium text-[#6b7280]">Healthgate™ Score</div>
                <div className="font-['DM_Mono'] text-[20px] font-semibold text-[#1a1a1a]">67/100</div>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Billing verified', status: 'PASS' },
                  { label: 'Domain verified', status: 'PASS' },
                  { label: '2FA enabled', status: 'PASS' },
                  { label: 'Conversion tracking', status: 'FAIL' },
                  { label: 'Policy compliance', status: 'PASS' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="font-['Sora'] text-[12px] text-[#1a1a1a]">{item.label}</div>
                    <div
                      className={`font-['DM_Mono'] text-[11px] font-semibold ${
                        item.status === 'PASS' ? 'text-[#16a34a]' : 'text-[#dc2626]'
                      }`}
                    >
                      {item.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
