'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, ExternalLink, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HealthgateRing } from '@/components/healthgate-ring';
import { StatusDot } from '@/components/status-dot';
import { useAppStore } from '@/lib/store';
import type { HealthCheck, HealthSnapshot } from '@/lib/healthgate';

function ConnectAccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setHealthSnapshot, setActiveAccountId, setOrgId, healthSnapshot, activeAccountId } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  // On mount: check if we already have a connected account in persisted store
  useEffect(() => {
    if (activeAccountId && !connected) {
      setConnected(true);
      // Refresh health if we don't have a snapshot yet
      if (!healthSnapshot) {
        fetchHealth(activeAccountId);
      }
    }
  }, []);

  // Handle OAuth callback redirect
  useEffect(() => {
    const connectedParam = searchParams.get('connected');
    const accountId = searchParams.get('account_id');
    const metaAccountId = searchParams.get('meta_account_id');
    const orgId = searchParams.get('org_id');

    if (connectedParam === '1' && accountId) {
      setActiveAccountId(accountId);
      if (orgId) setOrgId(orgId);
      setConnected(true);
      // Fetch health using the Meta account ID (act_...) if available, else the internal ID
      fetchHealth(metaAccountId || accountId);
    }
  }, [searchParams]);

  const fetchHealth = async (accountId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/health/sync?account_id=${encodeURIComponent(accountId)}`);
      const data = await res.json();
      if (data.snapshot) {
        setHealthSnapshot(data.snapshot);
      }
      // Fallback: set orgId from health/sync response if not already set
      if (data.orgId && !useAppStore.getState().orgId) {
        setOrgId(data.orgId);
      }
    } catch (err) {
      console.error('Health sync failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    window.location.href = '/api/auth/meta/start';
  };

  const handleRefreshHealth = async () => {
    const accountId = useAppStore.getState().activeAccountId;
    if (!accountId) return;
    await fetchHealth(accountId);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Connect Ad Account</h1>
          <p className="text-sm text-[#A1A1A1] mt-1">
            Connect your Meta ad account to run Healthgate™ diagnostics
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Connect card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Meta Business
            </CardTitle>
            <CardDescription>
              Connect your Meta Business ad account. We require ads_management, ads_read, and business_management permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!connected ? (
              <Button
                onClick={handleConnect}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                {loading ? 'Connecting...' : 'Connect Meta Ad Account'}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                  <span>Account connected</span>
                  {activeAccountId && (
                    <span className="text-xs text-[#A1A1A1] font-mono ml-auto truncate max-w-[180px]">
                      {activeAccountId}
                    </span>
                  )}
                </div>
                <Button
                  onClick={handleRefreshHealth}
                  variant="outline"
                  disabled={loading}
                  className="w-full"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Syncing…' : 'Refresh Healthgate'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const accountId = useAppStore.getState().activeAccountId;
                    if (accountId) router.push(`/accounts/${accountId}`);
                  }}
                  className="w-full"
                >
                  View Account Details →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Healthgate preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Healthgate™ Score
            </CardTitle>
            <CardDescription>
              Your ad account health determines if you can launch tests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {healthSnapshot ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <HealthgateRing
                  score={healthSnapshot.score}
                  status={healthSnapshot.status}
                  checks={healthSnapshot.checks}
                  size={96}
                />
                <div className="text-center">
                  <div className="text-3xl font-mono font-bold tabular-nums">
                    {healthSnapshot.score}
                    <span className="text-sm text-[#A1A1A1] font-normal">/100</span>
                  </div>
                  <Badge
                    variant={
                      healthSnapshot.status === 'green'
                        ? 'success'
                        : healthSnapshot.status === 'yellow'
                        ? 'warning'
                        : 'danger'
                    }
                    className="mt-1"
                  >
                    {healthSnapshot.status === 'green'
                      ? 'Launch Ready'
                      : healthSnapshot.status === 'yellow'
                      ? 'Review Needed'
                      : 'Launch Blocked'}
                  </Badge>
                </div>

                {healthSnapshot.status === 'red' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full mt-2 p-3 rounded-md border border-[#EF4444]/20 bg-[#EF4444]/5"
                  >
                    <div className="flex items-center gap-2 text-sm text-[#EF4444] font-medium mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      Launch Blocked
                    </div>
                    <p className="text-xs text-[#A1A1A1]">
                      Your health score is below 60. Fix the issues below before creating any tests. All &quot;New Test&quot; buttons are disabled.
                    </p>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-[#A1A1A1]">
                <Shield className="w-12 h-12 opacity-20" />
                <p className="text-sm">Connect an account to see health score</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ConnectAccountPage() {
  return (
    <Suspense>
      <ConnectAccountContent />
    </Suspense>
  );
}
