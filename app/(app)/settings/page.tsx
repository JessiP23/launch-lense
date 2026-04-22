'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';

function ByokForm() {
  const { setActiveAccountId, setOrgId } = useAppStore();
  const [accountId, setAccountId] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!accountId.trim() || !token.trim()) {
      setError('Both fields are required');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/accounts/byok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token.trim(), account_id: accountId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed');
        return;
      }
      setActiveAccountId(data.account.id);
      if (data.org_id) setOrgId(data.org_id);
      setSuccess(`Connected: ${data.account.name} (${data.account.account_id})`);
      setAccountId('');
      setToken('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E8E4DC] p-5 space-y-4">
      <div>
        <p className="font-display font-bold text-[1.0625rem] tracking-[-0.01em] text-[#111110]">
          Connect Meta Account
        </p>
        <p className="text-[0.875rem] text-[#8C8880] mt-0.5">
          Paste your Meta access token and ad account ID. Verified against the Meta Graph API before saving.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-1.5 block">
            Ad Account ID
          </label>
          <input
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="act_727146616453623"
            className="w-full bg-[#FAFAF8] border border-[#E8E4DC] rounded-lg px-3 py-2 text-[0.875rem] text-[#111110] font-mono focus:outline-none focus:border-[#111110]/30 transition-colors placeholder:text-[#8C8880]/50"
          />
        </div>
        <div>
          <label className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-1.5 block">
            Access Token
          </label>
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="EAAxxxxxxxxxxxxxxx..."
            rows={3}
            className="w-full bg-[#FAFAF8] border border-[#E8E4DC] rounded-lg px-3 py-2 text-[0.875rem] text-[#111110] font-mono resize-none focus:outline-none focus:border-[#111110]/30 transition-colors placeholder:text-[#8C8880]/50"
          />
          <p className="text-[0.75rem] text-[#8C8880] mt-1.5">
            Get from{' '}
            <a
              href="https://developers.facebook.com/tools/explorer/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#111110] underline underline-offset-2"
            >
              Meta Graph API Explorer
            </a>
            . Needs <code className="text-[0.6875rem] bg-[#F3F0EB] px-1 py-0.5 rounded">ads_management</code> scope.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-[#DC2626]/20 bg-[#FEF2F2] text-[0.875rem] text-[#DC2626]">
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-[#059669]/20 bg-[#ECFDF5] text-[0.875rem] text-[#059669]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={loading || !accountId || !token}
        className="h-9 px-5 rounded-full bg-[#111110] text-white text-[0.875rem] font-medium hover:bg-[#111110]/90 border-0 disabled:opacity-40"
      >
        {loading && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
        {loading ? 'Verifying…' : 'Connect Account'}
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const ENV_KEYS = ['META_APP_ID', 'META_APP_SECRET'];

  return (
    <div className="max-w-xl space-y-6">
      {/* Header */}
      <div>
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[#8C8880]">Settings</p>
        <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.03em] text-[#111110] mt-0.5">
          Platform Configuration
        </h1>
      </div>

      <ByokForm />

      {/* API Keys status */}
      <div className="bg-white rounded-xl border border-[#E8E4DC] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E8E4DC]">
          <p className="font-display font-bold text-[0.9375rem] tracking-[-0.01em] text-[#111110]">Environment Keys</p>
          <p className="text-[0.8125rem] text-[#8C8880] mt-0.5">Required server-side variables</p>
        </div>
        <div className="divide-y divide-[#E8E4DC]">
          {ENV_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between px-5 py-3">
              <span className="font-mono text-[0.8125rem] text-[#111110]">{key}</span>
              <span className="text-[0.75rem] text-[#8C8880] font-medium px-2.5 py-0.5 bg-[#F3F0EB] border border-[#E8E4DC] rounded-full">
                Not configured
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
