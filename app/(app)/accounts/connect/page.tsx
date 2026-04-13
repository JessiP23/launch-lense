'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, ExternalLink, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAppStore } from '@/lib/store';

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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Connect Meta Ad Account</h1>
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
                {loading ? 'Connecting...' : 'Login with Facebook'}
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
