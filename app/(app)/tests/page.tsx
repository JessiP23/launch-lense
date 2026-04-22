'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
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

function VerdictPill({ verdict }: { verdict?: string }) {
  if (!verdict) return null;
  const cfg =
    verdict === 'GO'
      ? { bg: '#ECFDF5', color: '#059669' }
      : verdict === 'NO-GO'
      ? { bg: '#FEF2F2', color: '#DC2626' }
      : { bg: '#FFFBEB', color: '#D97706' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem] font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {verdict}
    </span>
  );
}

function StatusPill({ status, verdict }: { status: string; verdict?: string }) {
  const dotStatus =
    status === 'active' ? 'green' : verdict === 'NO-GO' ? 'red' : 'yellow';
  return (
    <div className="flex items-center gap-1.5">
      <StatusDot status={dotStatus} pulse={status === 'active'} />
      <span className="text-[0.8125rem] capitalize text-[#8C8880]">{status}</span>
    </div>
  );
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
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[#8C8880] mb-1">
            Tests
          </p>
          <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.03em] text-[#111110]">
            Validation Tests
          </h1>
        </div>
        <Button
          onClick={() => router.push('/tests/new')}
          disabled={!canLaunch}
          className="h-9 px-5 rounded-full bg-[#111110] text-white text-[0.875rem] font-medium hover:bg-[#111110]/90 border-0 disabled:opacity-40"
        >
          {canLaunch ? '+ New Test' : 'Blocked by Healthgate'}
        </Button>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-[#E8E4DC] overflow-hidden">
        <table className="w-full text-[0.875rem]">
          <thead>
            <tr className="border-b border-[#E8E4DC]">
              {['Status', 'Name', 'Spend', 'Leads', 'CTR', 'Verdict', 'Created'].map(
                (h, i) => (
                  <th
                    key={h}
                    className={`py-3 px-4 text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] ${
                      i >= 2 ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {tests.map((test, idx) => (
              <tr
                key={test.id}
                onClick={() => router.push(`/tests/${test.id}`)}
                className={`h-12 cursor-pointer transition-colors hover:bg-[#F3F0EB] ${
                  idx < tests.length - 1 ? 'border-b border-[#E8E4DC]' : ''
                }`}
              >
                <td className="py-2 px-4">
                  <StatusPill status={test.status} verdict={test.verdict} />
                </td>
                <td className="py-2 px-4 font-medium text-[#111110]">{test.name}</td>
                <td className="py-2 px-4 text-right font-mono text-[0.8125rem] tabular-nums text-[#111110]">
                  ${((test.spend_cents || 0) / 100).toFixed(0)}
                </td>
                <td className="py-2 px-4 text-right font-mono text-[0.8125rem] tabular-nums text-[#111110]">
                  {test.leads || 0}
                </td>
                <td className="py-2 px-4 text-right font-mono text-[0.8125rem] tabular-nums text-[#111110]">
                  {((test.ctr || 0) * 100).toFixed(2)}%
                </td>
                <td className="py-2 px-4 text-right">
                  <VerdictPill verdict={test.verdict} />
                </td>
                <td className="py-2 px-4 text-right text-[0.8125rem] text-[#8C8880]">
                  {new Date(test.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}

            {!loading && tests.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <p className="text-[#8C8880] text-[0.9375rem]">No tests yet.</p>
                  <p className="text-[0.8125rem] text-[#8C8880]/60 mt-1">
                    Create your first validation test to get started.
                  </p>
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={7} className="py-16 text-center text-[#8C8880] text-[0.875rem]">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

