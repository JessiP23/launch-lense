'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Plus, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HealthgateRing } from '@/components/healthgate-ring';
import { StatusDot } from '@/components/status-dot';

interface AdAccount {
  id: string;
  account_id: string;
  name: string;
  status: string;
  health_score: number | null;
  health_status: string | null;
  last_checked_at: string | null;
}

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ad Accounts</h1>
          <p className="text-sm text-[#A1A1A1] mt-1">
            Manage connected Meta ad accounts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAccounts} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => { window.location.href = '/api/auth/meta/start'; }}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Connect Meta Account
          </Button>
        </div>
      </div>

      {loading && accounts.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-[#A1A1A1] animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <Shield className="w-12 h-12 text-[#262626]" />
            <div className="text-center">
              <h3 className="font-semibold">No ad accounts connected</h3>
              <p className="text-sm text-[#A1A1A1] mt-1">
                Connect your Meta Business ad account to get started
              </p>
            </div>
            <Button onClick={() => { window.location.href = '/api/auth/meta/start'; }}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Connect Meta Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#262626]">
                  <th className="py-2 px-3 text-left text-[#A1A1A1] font-medium w-10">Status</th>
                  <th className="py-2 px-3 text-left text-[#A1A1A1] font-medium">Account</th>
                  <th className="py-2 px-3 text-left text-[#A1A1A1] font-medium w-20">Health</th>
                  <th className="py-2 px-3 text-left text-[#A1A1A1] font-medium w-36">Last Checked</th>
                  <th className="py-2 px-3 text-right text-[#A1A1A1] font-medium w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr
                    key={a.account_id}
                    className="border-b border-[#262626]/50 h-12 hover:bg-[#111111] transition-colors"
                  >
                    <td className="py-2 px-3">
                      <StatusDot status={a.status === 'active' ? 'green' : 'red'} />
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-medium">{a.name || 'Unnamed'}</div>
                      <div className="text-xs text-[#A1A1A1] font-mono">{a.account_id}</div>
                    </td>
                    <td className="py-2 px-3">
                      {a.health_score !== null ? (
                        <HealthgateRing
                          score={a.health_score}
                          status={(a.health_status as 'red' | 'yellow' | 'green') || 'red'}
                          checks={[]}
                          size={32}
                        />
                      ) : (
                        <span className="text-xs text-[#A1A1A1]">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs text-[#A1A1A1]">
                      {a.last_checked_at
                        ? new Date(a.last_checked_at).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/accounts/${a.id}`)}
                      >
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
