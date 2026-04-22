'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CheckCircle2, AlertTriangle, ExternalLink, RefreshCw,
  Unlink, Shield, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore, type PlatformId, type ConnectedPlatform } from '@/lib/store';

// ── Platform definitions ───────────────────────────────────────────────────

interface PlatformDef {
  id: PlatformId;
  name: string;
  icon: string;
  color: string;
  description: string;
  authUrl: string | null;
  capabilities: string[];
  demoConnect: boolean; // can connect with fake data for demo
}

const PLATFORMS: PlatformDef[] = [
  {
    id: 'meta',
    name: 'Meta (Facebook & Instagram)',
    icon: '📘',
    color: '#1877F2',
    description: 'Run paid ads on Facebook Feed, Instagram Feed, Reels, and Stories.',
    authUrl: null,
    capabilities: ['Paid Ads', 'Audience Insights', 'Pixel Tracking', 'Policy Scan'],
    demoConnect: false,
  },
  {
    id: 'google',
    name: 'Google Ads',
    icon: '🔍',
    color: '#4285F4',
    description: 'Search, Display, and YouTube campaigns. High purchase-intent traffic.',
    authUrl: null, // coming soon
    capabilities: ['Search Ads', 'Responsive Display', 'Keyword Planner', 'Conversion Tracking'],
    demoConnect: true,
  },
  {
    id: 'tiktok',
    name: 'TikTok Ads',
    icon: '🎵',
    color: '#FF0050',
    description: 'Short-form video ads for Gen Z and millennial audiences.',
    authUrl: null,
    capabilities: ['In-Feed Video', 'TopView', 'Spark Ads', 'TikTok Pixel'],
    demoConnect: true,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Ads',
    icon: '💼',
    color: '#0A66C2',
    description: 'B2B targeting by job title, company, seniority, and industry.',
    authUrl: null,
    capabilities: ['Sponsored Content', 'Message Ads', 'Lead Gen Forms', 'Matched Audiences'],
    demoConnect: true,
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const router = useRouter();
  const { connectedPlatforms, connectPlatform, disconnectPlatform, healthSnapshot } = useAppStore();
  const [demoConnecting, setDemoConnecting] = useState<PlatformId | null>(null);
  const [disconnecting, setDisconnecting] = useState<PlatformId | null>(null);

  const getConn = (id: PlatformId): ConnectedPlatform | null =>
    connectedPlatforms.find((c) => c.platform === id) ?? null;

  const handleDemoConnect = async (platform: PlatformDef) => {
    setDemoConnecting(platform.id);
    // Simulate OAuth delay
    await new Promise((r) => setTimeout(r, 1200));
    connectPlatform({
      platform: platform.id,
      accountId: `demo_${platform.id}_${Date.now()}`,
      accountName: `Demo ${platform.name} Account`,
      connectedAt: new Date().toISOString(),
    });
    setDemoConnecting(null);
  };

  const handleDisconnect = async (id: PlatformId) => {
    setDisconnecting(id);
    await new Promise((r) => setTimeout(r, 600));
    disconnectPlatform(id);
    setDisconnecting(null);
  };

  const connectedCount = connectedPlatforms.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Platform Connections</h1>
          <p className="text-sm text-[#A1A1A1] mt-1">
            Connect ad accounts once — reused across every test you create.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {connectedCount > 0 && (
            <Badge variant="success">{connectedCount} platform{connectedCount > 1 ? 's' : ''} connected</Badge>
          )}
          {healthSnapshot && (
            <Badge variant={healthSnapshot.status === 'green' ? 'success' : 'warning'}>
              <Shield className="w-3 h-3 mr-1" />
              Healthgate {healthSnapshot.score}/100
            </Badge>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-[#262626] bg-[#0D0D0D]">
        <Zap className="w-4 h-4 text-[#FAFAFA] mt-0.5 shrink-0" />
        <div className="text-sm text-[#A1A1A1]">
          <strong className="text-[#FAFAFA]">Connect once, use everywhere.</strong>{' '}
          Once a platform is connected here, it&apos;s automatically available when creating tests —
          no re-login required. Connections are stored in your browser session.
        </div>
      </div>

      {/* Platform grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORMS.map((platform, i) => {
          const conn = getConn(platform.id);
          const isConnected = !!conn;
          const isDemo = conn?.accountId?.startsWith('demo_');
          const isConnecting = demoConnecting === platform.id;
          const isDisconnecting = disconnecting === platform.id;

          return (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={`transition-all ${isConnected ? 'border-[#262626] bg-[#0D0D0D]' : 'border-[#1E1E1E]'}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                        style={{ backgroundColor: `${platform.color}18`, border: `1px solid ${platform.color}30` }}
                      >
                        {platform.icon}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          {platform.name}
                          {isConnected && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-[#22C55E]">
                              <CheckCircle2 className="w-3 h-3" />
                              {isDemo ? 'Demo' : 'Live'}
                            </span>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">{platform.description}</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Capabilities */}
                  <div className="flex flex-wrap gap-1">
                    {platform.capabilities.map((cap) => (
                      <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1A1A1A] text-[#666] border border-[#262626]">
                        {cap}
                      </span>
                    ))}
                  </div>

                  {/* Connected account info */}
                  {isConnected && conn && (
                    <div className="p-2.5 rounded-md bg-[#22C55E]/5 border border-[#22C55E]/20 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#22C55E] font-medium">{conn.accountName}</span>
                        <span className="text-[#4A4A4A]">
                          since {new Date(conn.connectedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-[#4A4A4A] font-mono mt-0.5">{conn.accountId}</div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!isConnected ? (
                      <>
                        {platform.authUrl ? (
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => { window.location.href = platform.authUrl!; }}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                            Connect {platform.name.split(' ')[0]}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            disabled={isConnecting}
                            onClick={() => handleDemoConnect(platform)}
                          >
                            {isConnecting ? (
                              <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Connecting...</>
                            ) : (
                              <><Zap className="w-3.5 h-3.5 mr-1.5" />Connect (Demo)</>
                            )}
                          </Button>
                        )}
                        {!platform.authUrl && (
                          <span className="text-[10px] text-[#4A4A4A]">Live API coming soon</span>
                        )}
                      </>
                    ) : (
                      <>
                        {platform.id === 'meta' && !isDemo && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => router.push('/accounts/connect')}
                          >
                            <Shield className="w-3.5 h-3.5 mr-1.5" />
                            View Health
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[#EF4444] border-[#EF4444]/20 hover:bg-[#EF4444]/5"
                          disabled={isDisconnecting}
                          onClick={() => handleDisconnect(platform.id)}
                        >
                          {isDisconnecting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <><Unlink className="w-3.5 h-3.5 mr-1.5" />Disconnect</>
                          )}
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Coming soon note for non-Meta */}
                  {!isConnected && (
                    <p className="text-[10px] text-[#4A4A4A]">
                      Demo mode generates real AI copy for this channel. Live API integration is in development.
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Quick link to create test */}
      {connectedCount > 0 && (
        <div className="flex items-center justify-between p-4 rounded-lg border border-[#262626] bg-[#0D0D0D]">
          <div className="text-sm">
            <span className="text-[#FAFAFA] font-medium">{connectedCount} platform{connectedCount > 1 ? 's' : ''} ready.</span>
            <span className="text-[#A1A1A1]"> Start a new test to generate multi-channel campaigns.</span>
          </div>
          <Button size="sm" onClick={() => router.push('/tests/new')}>
            Create Test
            <Zap className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
