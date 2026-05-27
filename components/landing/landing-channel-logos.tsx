'use client';

import { motion } from 'framer-motion';

export function LandingChannelLogos() {
  const channels = [
    { name: 'Google Ads' },
    { name: 'Meta Ads' },
    { name: 'LinkedIn Ads' },
    { name: 'TikTok Ads' },
  ];

  return (
    <section className="py-16 px-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <p className="font-['Sora'] text-[12px] font-medium text-[#6b7280] uppercase tracking-widest mb-6">
            Validate across these channels
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
            {channels.map((channel, i) => (
              <motion.div
                key={channel.name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="font-['Sora'] text-[14px] font-normal text-[#6b7280]"
              >
                {channel.name}
                {i < channels.length - 1 && <span className="mx-2">·</span>}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
