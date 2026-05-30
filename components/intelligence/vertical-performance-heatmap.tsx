'use client';

import { useEffect, useState } from 'react';
import type { BenchmarkRow } from '@/lib/signal-fabric';

const C = { ink: '#111110', muted: '#8C8880', border: '#E8E4DC', surface: '#FFFFFF', faint: '#F3F0EB' };

const VERTICALS = ['saas', 'fintech', 'health', 'ecommerce', 'consumer', 'b2b', 'other'] as const;
const CHANNELS = ['meta', 'google', 'linkedin', 'tiktok'] as const;

export function VerticalPerformanceHeatmap({ orgId }: { orgId: string | null }) {
  const [benchmarks, setBenchmarks] = useState<BenchmarkRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchBenchmarks() {
      try {
        const { getVerticalBenchmarks } = await import('@/lib/signal-fabric');
        // Fetch benchmarks for all verticals
        const allBenchmarks: BenchmarkRow[] = [];
        for (const vertical of VERTICALS) {
          const verticalBenchmarks = await getVerticalBenchmarks(vertical);
          allBenchmarks.push(...verticalBenchmarks);
        }
        setBenchmarks(allBenchmarks);
      } catch (err) {
        console.error('Failed to fetch benchmarks:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchBenchmarks();
  }, []);

  // Create a lookup map for benchmarks
  const benchmarkMap = new Map<string, BenchmarkRow>();
  for (const b of benchmarks) {
    benchmarkMap.set(`${b.vertical}-${b.channel}`, b);
  }

  // Get CTR value for a vertical/channel pair
  const getCtr = (vertical: string, channel: string): number | null => {
    const key = `${vertical}-${channel}`;
    return benchmarkMap.get(key)?.avg_ctr ?? null;
  };

  // Get sample size for a vertical/channel pair
  const getSampleSize = (vertical: string, channel: string): number => {
    const key = `${vertical}-${channel}`;
    return benchmarkMap.get(key)?.sample_size ?? 0;
  };

  // Get color based on CTR value (heatmap coloring)
  const getColor = (ctr: number | null): string => {
    if (ctr == null) return '#F3F0EB';
    // Normalize CTR to 0-100 scale (assuming max CTR is 3%)
    const normalized = Math.min(100, (ctr / 0.03) * 100);
    // Green gradient: lighter green for lower CTR, darker for higher
    const green = Math.round(50 + (normalized / 100) * 150);
    return `rgb(${100 - normalized}, ${green}, ${150 - normalized / 2})`;
  };

  // Get text color based on background
  const getTextColor = (ctr: number | null): string => {
    if (ctr == null) return C.muted;
    return ctr > 0.015 ? '#FFFFFF' : C.ink;
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: C.muted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          VERTICAL PERFORMANCE HEATMAP
        </div>
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13 }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
      <div style={{ fontSize: '10px', fontWeight: 500, color: C.muted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        VERTICAL PERFORMANCE HEATMAP
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${C.border}`, color: C.muted, fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.05em' }}>
                Vertical
              </th>
              {CHANNELS.map((channel) => (
                <th key={channel} style={{ textAlign: 'center', padding: '8px 12px', borderBottom: `1px solid ${C.border}`, color: C.muted, fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.05em', minWidth: 80 }}>
                  {channel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VERTICALS.map((vertical) => (
              <tr key={vertical}>
                <td style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${C.border}`, color: C.ink, fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }}>
                  {vertical}
                </td>
                {CHANNELS.map((channel) => {
                  const ctr = getCtr(vertical, channel);
                  const sampleSize = getSampleSize(vertical, channel);
                  const bgColor = getColor(ctr);
                  const textColor = getTextColor(ctr);

                  return (
                    <td key={channel} style={{ textAlign: 'center', padding: '8px', borderBottom: `1px solid ${C.border}`, minWidth: 80 }}>
                      <div
                        style={{
                          backgroundColor: bgColor,
                          color: textColor,
                          padding: '8px 4px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          transition: 'transform 0.2s ease',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <div>{ctr != null ? `${(ctr * 100).toFixed(2)}%` : 'N/A'}</div>
                        {sampleSize > 0 && (
                          <div style={{ fontSize: 9, opacity: 0.7, fontWeight: 500 }}>n={sampleSize}</div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
        <span style={{ fontWeight: 600 }}>CTR</span> by vertical × channel (darker = higher performance)
      </div>
    </div>
  );
}
