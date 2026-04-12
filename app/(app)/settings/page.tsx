'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Key, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="w-4 h-4" />
          BYOK — Bring Your Own Key
        </CardTitle>
        <CardDescription>
          Paste your Meta access token and ad account ID directly. The token will be verified against the Meta Graph API before saving.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs text-[#A1A1A1] uppercase tracking-wider mb-1.5 block">
            Ad Account ID
          </label>
          <input
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="act_727146616453623  or  727146616453623"
            className="w-full bg-[#111] border border-[#262626] rounded-lg px-3 py-2 text-sm text-[#FAFAFA] font-mono focus:outline-none focus:border-[#FAFAFA]/40 transition-colors placeholder:text-[#444]"
          />
        </div>
        <div>
          <label className="text-xs text-[#A1A1A1] uppercase tracking-wider mb-1.5 block">
            Access Token
          </label>
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="EAAxxxxxxxxxxxxxxx..."
            rows={3}
            className="w-full bg-[#111] border border-[#262626] rounded-lg px-3 py-2 text-sm text-[#FAFAFA] font-mono resize-none focus:outline-none focus:border-[#FAFAFA]/40 transition-colors placeholder:text-[#444]"
          />
          <p className="text-xs text-[#555] mt-1.5">
            Get from{' '}
            <a
              href="https://developers.facebook.com/tools/explorer/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#A1A1A1] hover:text-[#FAFAFA] underline underline-offset-2"
            >
              Meta Graph API Explorer
            </a>
            . Needs <code className="text-[10px] bg-[#1a1a1a] px-1 py-0.5 rounded">ads_management</code> scope.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-[#22C55E]/10 border border-[#22C55E]/20 text-sm text-[#22C55E]">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            {success}
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={loading || !accountId || !token}
          className="w-full"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Key className="w-4 h-4 mr-2" />
          )}
          {loading ? 'Verifying & Connecting…' : 'Connect Account'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-[#A1A1A1] mt-1">
          Platform configuration and environment settings
        </p>
      </div>

      <ByokForm />


      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>Status of required environment variables</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {[
                'META_APP_ID',
                'META_APP_SECRET',
              ].map((key) => (
                <tr key={key} className="border-b border-[#262626]/50 h-10">
                  <td className="py-2 text-[#A1A1A1] font-mono text-xs w-64">{key}</td>
                  <td className="py-2">
                    <Badge variant="outline">Not configured</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
