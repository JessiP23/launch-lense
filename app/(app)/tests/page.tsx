'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusDot } from '@/components/status-dot';
import { useAppStore } from '@/lib/store';

interface TestRow {
  id: string;
  name: string;
  status: string;
  spend_cents?: number;
  leads?: number;
  ctr?: number;
  verdict?: string;
  created_at: string;
}

export default function TestsListPage() {
  const router = useRouter();
  const { canLaunch } = useAppStore();
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTests() {
      try {
        const res = await fetch('/api/tests');
        if (res.ok) {
          const data = await res.json();
          setTests(data.tests || []);
        }
      } catch (err) {
        console.error('Failed to fetch tests:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTests();
  }, []);

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
              {tests.map((test) => (
                <tr
                  key={test.id}
                  className="border-b border-[#262626]/50 h-10 hover:bg-[#111111] cursor-pointer transition-colors"
                  onClick={() => router.push(`/tests/${test.id}`)}
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
                    ${((test.spend_cents || 0) / 100).toFixed(0)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                    {test.leads || 0}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                    {((test.ctr || 0) * 100).toFixed(2)}%
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
              {!loading && tests.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#A1A1A1]">
                    <Zap className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p>No tests yet. Create your first validation test.</p>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#A1A1A1]">
                    Loading tests...
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
