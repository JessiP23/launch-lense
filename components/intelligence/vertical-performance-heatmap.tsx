'use client';

import { useEffect, useState } from 'react';
import type { BenchmarkRow } from '@/lib/signal-fabric';

const C = { ink: '#111110', muted: '#8C8880', border: '#E8E4DC', surface: '#FFFFFF', faint: '#F3F0EB', go: '#0F8A4C' };

const VERTICALS = [
  { id: 'saas', label: 'SaaS', description: 'Software-as-a-Service' },
  { id: 'fintech', label: 'Fintech', description: 'Financial Technology' },
  { id: 'health', label: 'Health', description: 'Healthcare & Wellness' },
  { id: 'ecommerce', label: 'E-commerce', description: 'Online Retail' },
  { id: 'consumer', label: 'Consumer', description: 'Consumer Apps' },
  { id: 'b2b', label: 'B2B', description: 'Business-to-Business' },
  { id: 'other', label: 'Other', description: 'Other Verticals' },
] as const;

const CHANNELS = [
  { id: 'meta', label: 'Meta', icon: '📘' },
  { id: 'google', label: 'Google', icon: '🔍' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
] as const;

export function VerticalPerformanceHeatmap({ orgId }: { orgId: string | null }) {
  const [benchmarks, setBenchmarks] = useState<BenchmarkRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<{ vertical: string; channel: string } | null>(null);

  useEffect(() => {
    async function fetchBenchmarks() {
      try {
        const allBenchmarks: BenchmarkRow[] = [];
        for (const { id: vertical } of VERTICALS) {
          const response = await fetch(`/api/signal/benchmarks/${vertical}`);
          const data = await response.json();
          allBenchmarks.push(...(data.benchmarks || []));
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

  const benchmarkMap = new Map<string, BenchmarkRow>();
  for (const b of benchmarks) {
    benchmarkMap.set(`${b.vertical}-${b.channel}`, b);
  }

  const getData = (vertical: string, channel: string) => {
    const key = `${vertical}-${channel}`;
    return benchmarkMap.get(key);
  };

  const getColor = (ctr: number | null): string => {
    if (ctr == null) return '#F3F0EB';
    const pct = ctr * 100;
    if (pct >= 2.0) return '#0F8A4C'; // Excellent (≥2%)
    if (pct >= 1.5) return '#22C55E'; // Good (1.5-2%)
    if (pct >= 1.0) return '#84CC16'; // Fair (1-1.5%)
    if (pct >= 0.5) return '#EAB308'; // Poor (0.5-1%)
    return '#DC2626'; // Critical (<0.5%)
  };

  const getTextColor = (ctr: number | null): string => {
    if (ctr == null) return C.muted;
    const pct = ctr * 100;
    return pct >= 1.0 ? '#FFFFFF' : C.ink;
  };

  const getPerformanceLabel = (ctr: number | null): string => {
    if (ctr == null) return 'No Data';
    const pct = ctr * 100;
    if (pct >= 2.0) return 'Excellent';
    if (pct >= 1.5) return 'Good';
    if (pct >= 1.0) return 'Fair';
    if (pct >= 0.5) return 'Poor';
    return 'Critical';
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: C.muted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Vertical Performance Heatmap
        </div>
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13 }}>
          Loading benchmark data...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Vertical Performance Heatmap
        </div>
        <div style={{ fontSize: 11, color: C.muted }}>
          Click-through rate by industry × channel
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: `2px solid ${C.border}`, color: C.ink, fontWeight: 700, fontSize: 11 }}>
                Industry
              </th>
              {CHANNELS.map((channel) => (
                <th key={channel.id} style={{ textAlign: 'center', padding: '12px 8px', borderBottom: `2px solid ${C.border}`, color: C.ink, fontWeight: 700, fontSize: 11, minWidth: 90 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontSize: 16 }}>{channel.icon}</span>
                    <span>{channel.label}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VERTICALS.map((vertical) => (
              <tr key={vertical.id}>
                <td style={{ textAlign: 'left', padding: '12px 16px', borderBottom: `1px solid ${C.border}`, color: C.ink, fontWeight: 600, fontSize: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{vertical.label}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{vertical.description}</div>
                  </div>
                </td>
                {CHANNELS.map((channel) => {
                  const data = getData(vertical.id, channel.id);
                  const ctr = data?.avg_ctr ?? null;
                  const sampleSize = data?.sample_size ?? 0;
                  const bgColor = getColor(ctr);
                  const textColor = getTextColor(ctr);
                  const performanceLabel = getPerformanceLabel(ctr);

                  return (
                    <td key={channel.id} style={{ textAlign: 'center', padding: '8px', borderBottom: `1px solid ${C.border}`, minWidth: 90 }}>
                      <div
                        style={{
                          backgroundColor: bgColor,
                          color: textColor,
                          padding: '10px 6px',
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 700,
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                          setHoveredCell({ vertical: vertical.id, channel: channel.id });
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                          setHoveredCell(null);
                        }}
                      >
                        <div>{ctr != null ? `${(ctr * 100).toFixed(2)}%` : '—'}</div>
                        {sampleSize > 0 && (
                          <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 500, marginTop: 2 }}>
                            {sampleSize} sprints
                          </div>
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

      {hoveredCell && (
        <div style={{ marginTop: 12, padding: 12, background: '#F9FAFB', borderRadius: 8, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.ink, marginBottom: 4 }}>
            {VERTICALS.find((v) => v.id === hoveredCell.vertical)?.label} × {CHANNELS.find((c) => c.id === hoveredCell.channel)?.label}
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            {getData(hoveredCell.vertical, hoveredCell.channel)?.avg_ctr 
              ? `Average CTR: ${(getData(hoveredCell.vertical, hoveredCell.channel)!.avg_ctr! * 100).toFixed(2)}%` 
              : 'No data available'}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 16, fontSize: 10, color: C.muted, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#0F8A4C' }} />
          <span>Excellent (≥2%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#22C55E' }} />
          <span>Good (1.5-2%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#84CC16' }} />
          <span>Fair (1-1.5%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#EAB308' }} />
          <span>Poor (0.5-1%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#DC2626' }} />
          <span>Critical (&lt;0.5%)</span>
        </div>
      </div>
    </div>
  );
}
