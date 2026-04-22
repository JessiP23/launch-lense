'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';

function ConnectPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    connectPlatform,
    setHealthSnapshot,
    setActiveAccountId,
    setOrgId,
  } = useAppStore();

  const [status, setStatus] = useState<'processing' | 'success' | 'idle'>('idle');
  const [platformName, setPlatformName] = useState('');

  useEffect(() => {
    const connectedParam = searchParams.get('connected');
    const accountId = searchParams.get('account_id');
    const metaAccountId = searchParams.get('meta_account_id');
    const orgId = searchParams.get('org_id');

    if (connectedParam === '1' && accountId) {
      setStatus('processing');
      setPlatformName('Meta');
      setActiveAccountId(accountId);
      connectPlatform({
        platform: 'meta',
        accountId,
        accountName: 'Meta Ad Account',
        connectedAt: new Date().toISOString(),
      });
      if (orgId) setOrgId(orgId);

      fetch(`/api/health/sync?account_id=${encodeURIComponent(metaAccountId || accountId)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.snapshot) setHealthSnapshot(data.snapshot);
          if (data.orgId && !useAppStore.getState().orgId) setOrgId(data.orgId);
        })
        .catch(console.error)
        .finally(() => {
          setStatus('success');
          setTimeout(() => router.push('/accounts'), 2000);
        });
    } else {
      // No OAuth params — go straight back to accounts
      router.replace('/accounts');
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'idle') return null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-2xl border border-[#E8E4DC] p-10 flex flex-col items-center gap-6 max-w-sm w-full text-center shadow-sm"
      >
        {status === 'processing' ? (
          <>
            <Loader2 className="w-8 h-8 text-[#8C8880] animate-spin" />
            <div>
              <p className="font-display text-[1.0625rem] font-bold tracking-[-0.01em] text-[#111110]">
                Connecting {platformName}
              </p>
              <p className="text-[0.875rem] text-[#8C8880] mt-1">
                Syncing your account data…
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full border-2 border-[#059669] flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-[#059669]" />
            </div>
            <div>
              <p className="font-display text-[1.0625rem] font-bold tracking-[-0.01em] text-[#111110]">
                {platformName} connected
              </p>
              <p className="text-[0.875rem] text-[#8C8880] mt-1">
                Returning to your accounts…
              </p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function ConnectAccountPage() {
  return (
    <Suspense>
      <ConnectPageContent />
    </Suspense>
  );
}
