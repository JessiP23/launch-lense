'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAppStore, type PlatformId, type ConnectedPlatform } from '@/lib/store';

interface PlatformDef {
  id: PlatformId;
  name: string;
  shortName: string;
  accent: string;       // brand color used only for the side rule
  reach: string;        // one-line reach stat
  description: string;
  authUrl: string | null;
  capabilities: string[];
  demoConnect: boolean;
}

const PLATFORMS: PlatformDef[] = [
  {
    id: 'meta',
    name: 'Meta Ads',
    shortName: 'Meta',
    accent: '#1877F2',
    reach: '3.2 B monthly active users',
    description: 'Facebook, Instagram & Reels — broadest social inventory.',
    authUrl: null,
    capabilities: ['Paid Social', 'Pixel Tracking', 'Audience Graph', 'Policy Scan'],
    demoConnect: false,
  },
  {
    id: 'google',
    name: 'Google Ads',
    shortName: 'Google',
    accent: '#EA4335',
    reach: '8.5 B daily searches',
    description: 'Search, Display & YouTube — capture high purchase intent.',
    authUrl: null,
    capabilities: ['Search Ads', 'Display', 'Keyword Planner', 'Conversions'],
    demoConnect: true,
  },
  {
    id: 'tiktok',
    name: 'TikTok Ads',
    shortName: 'TikTok',
    accent: '#111110',
    reach: '1.5 B monthly active users',
    description: 'Short-form video reaching Gen Z & millennials at scale.',
    authUrl: null,
    capabilities: ['In-Feed Video', 'TopView', 'Spark Ads', 'TikTok Pixel'],
    demoConnect: true,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Ads',
    shortName: 'LinkedIn',
    accent: '#0A66C2',
    reach: '1 B professional members',
    description: 'Precision B2B targeting by role, seniority & company.',
    authUrl: null,
    capabilities: ['Sponsored Content', 'Message Ads', 'Lead Gen Forms', 'Matched Audiences'],
    demoConnect: true,
  },
];

export default function AccountsPage() {
  const router = useRouter();
  const { connectedPlatforms, connectPlatform, disconnectPlatform } = useAppStore();
  const [demoConnecting, setDemoConnecting] = useState<PlatformId | null>(null);
  const [disconnecting, setDisconnecting] = useState<PlatformId | null>(null);

  const getConn = (id: PlatformId): ConnectedPlatform | null =>
    connectedPlatforms.find((c) => c.platform === id) ?? null;

  const handleDemoConnect = async (platform: PlatformDef) => {
    setDemoConnecting(platform.id);
    await new Promise((r) => setTimeout(r, 1100));
    connectPlatform({
      platform: platform.id,
      accountId: `demo_${platform.id}_${Date.now()}`,
      connectedAt: new Date().toISOString(),
    });
    setDemoConnecting(null);
  };

  const handleDisconnect = async (id: PlatformId) => {
    setDisconnecting(id);
    await new Promise((r) => setTimeout(r, 500));
    disconnectPlatform(id);
    setDisconnecting(null);
  };

  const connectedCount = connectedPlatforms.length;

  return (
    <div className="w-full space-y-8">

      {/* ── Page header ── */}
      <div className="space-y-1">
        <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.03em] text-[#111110]">
          Ad Channels
        </h1>
        <p className="text-[0.9375rem] text-[#8C8880]">
          Connect your ad accounts once. Every test you create draws on these connections automatically.
        </p>
      </div>

      {/* ── Connected bar ── */}
      {connectedCount > 0 && (
        <div className="flex items-center justify-between px-5 py-3.5 rounded-xl border border-[#E8E4DC] bg-white">
          <div className="flex items-center gap-2.5">
            <p className="text-[0.875rem] text-[#111110]">
              <span className="font-semibold tabular-nums">{connectedCount}</span>
              <span className="text-[#8C8880]"> channel{connectedCount > 1 ? 's' : ''} active</span>
            </p>
          </div>
          <button
            onClick={() => router.push('/tests/new')}
            className="h-8 px-4 rounded-full bg-[#111110] text-white text-[0.8125rem] font-medium hover:bg-[#111110]/90 transition-colors"
          >
            New Test →
          </button>
        </div>
      )}

      {/* ── Platform grid ── */}
      <div className="grid grid-cols-2 gap-3">
        {PLATFORMS.map((platform, i) => {
          const conn = getConn(platform.id);
          const isConnected = !!conn;
          const isConnecting = demoConnecting === platform.id;
          const isDisconnecting = disconnecting === platform.id;

          return (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <div className={`relative bg-white rounded-xl border overflow-hidden transition-all duration-200 h-full flex flex-col ${
                isConnected ? 'border-[#111110]/12' : 'border-[#E8E4DC]'
              }`}>
                <div className="pl-5 pr-4 py-4 flex flex-col gap-3 flex-1">

                  {/* Name + category + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-display font-bold text-[0.9375rem] tracking-[-0.01em] text-[#111110]">
                          {platform.name}
                        </p>
                      </div>
                      <p className="text-[0.6875rem] text-[#8C8880] font-mono mt-0.5">{platform.reach}</p>
                    </div>
                  </div>

                  {/* Description — one tight line */}
                  <p className="text-[0.75rem] text-[#8C8880] leading-snug">
                    {platform.description}
                  </p>

                  {/* Capability tags */}
                  <div className="flex flex-wrap gap-1">
                    {platform.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="text-[0.625rem] font-medium text-[#111110] px-1.5 py-0.5 border border-[#E8E4DC] rounded-full bg-[#FAFAF8]"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-auto">
                    {!isConnected ? (
                      <button
                        onClick={() =>
                          platform.authUrl
                            ? (window.location.href = platform.authUrl!)
                            : handleDemoConnect(platform)
                        }
                        disabled={isConnecting}
                        className="h-7 px-3.5 rounded-full bg-[#111110] text-white text-[0.75rem] font-medium hover:bg-[#111110]/90 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                      >
                        {isConnecting ? (
                          <><Loader2 className="w-3 h-3 animate-spin" />Connecting…</>
                        ) : (
                          platform.authUrl ? `Connect ${platform.shortName}` : 'Connect'
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDisconnect(platform.id)}
                        disabled={isDisconnecting}
                        className="h-7 px-3.5 rounded-full border border-[#DC2626]/30 text-[0.75rem] font-medium text-[#DC2626] bg-[#FEF2F2] hover:bg-[#DC2626] hover:text-white hover:border-[#DC2626] transition-colors disabled:opacity-40 flex items-center gap-1.5"
                      >
                        {isDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Disconnect'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
}
