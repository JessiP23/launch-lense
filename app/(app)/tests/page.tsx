'use client';

import { useRouter } from 'next/navigation';
import { Zap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusDot } from '@/components/status-dot';
import { useAppStore } from '@/lib/store';

// Demo test data
const demoTests = [
  {
    id: 'test-demo-1',
    name: 'AI for Dentists',
    status: 'active',
    spend_cents: 28700,
    leads: 6,
    ctr: 0.012,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'test-demo-2',
    name: 'Pet Insurance Marketplace',
    status: 'completed',
    spend_cents: 48700,
    leads: 2,
    ctr: 0.005,
    verdict: 'NO-GO',
    created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  },
];

export default function TestsListPage() {
  const router = useRouter();
  const { canLaunch, isDemo } = useAppStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Validation Tests</h1>
          <p className="text-sm text-[#A1A1A1] mt-1">
            48-hour ad validation campaigns
          </p>
        </div>
        <Button
          onClick={() => router.push('/tests/new')}
          disabled={!canLaunch}
        >
          <Plus className="w-4 h-4 mr-2" />
          {canLaunch ? 'New Test' : 'Blocked by Healthgate'}
        </Button>
      </div>

      {/* Tests table */}
      <Card>
        <CardContent className="pt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#262626]">
                <th className="py-2 px-3 text-left text-[#A1A1A1] font-medium">Status</th>
                <th className="py-2 px-3 text-left text-[#A1A1A1] font-medium">Name</th>
                <th className="py-2 px-3 text-right text-[#A1A1A1] font-medium">Spend</th>
                <th className="py-2 px-3 text-right text-[#A1A1A1] font-medium">Leads</th>
                <th className="py-2 px-3 text-right text-[#A1A1A1] font-medium">CTR</th>
                <th className="py-2 px-3 text-left text-[#A1A1A1] font-medium">Verdict</th>
                <th className="py-2 px-3 text-right text-[#A1A1A1] font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {isDemo &&
                demoTests.map((test) => (
                  <tr
                    key={test.id}
                    className="border-b border-[#262626]/50 h-10 hover:bg-[#111111] cursor-pointer transition-colors"
                    onClick={() => router.push(`/tests/${test.id}?demo=1`)}
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <StatusDot
                          status={
                            test.status === 'active'
                              ? 'green'
                              : test.verdict === 'NO-GO'
                              ? 'red'
                              : 'yellow'
                          }
                          pulse={test.status === 'active'}
                        />
                        <span className="text-xs capitalize">{test.status}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 font-medium">{test.name}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      ${(test.spend_cents / 100).toFixed(0)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {test.leads}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {(test.ctr * 100).toFixed(2)}%
                    </td>
                    <td className="py-2 px-3">
                      {test.verdict && (
                        <Badge variant={test.verdict === 'GO' ? 'success' : 'danger'}>
                          {test.verdict}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-[#A1A1A1] text-xs">
                      {new Date(test.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              {!isDemo && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#A1A1A1]">
                    <Zap className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p>No tests yet. Create your first validation test.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
