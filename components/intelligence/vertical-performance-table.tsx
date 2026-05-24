'use client';

import { useIntelligence } from '@/hooks/use-intelligence';

const C = { ink: '#111110', muted: '#8C8880', border: '#E8E4DC', surface: '#FFFFFF', faint: '#F3F0EB' };

const VERTICAL_KEYWORDS: Record<string, string[]> = {
  fintech: ['bank', 'finance', 'payment', 'crypto', 'trading', 'invest', 'loan', 'credit'],
  health: ['health', 'medical', 'doctor', 'wellness', 'fitness', 'therapy', 'pharma'],
  saas: ['software', 'platform', 'tool', 'app', 'dashboard', 'analytics', 'automation'],
  ecommerce: ['shop', 'store', 'market', 'sell', 'buy', 'retail', 'commerce'],
  marketplace: ['marketplace', 'platform', 'connect', 'matching', 'gig', 'freelance'],
  edtech: ['education', 'learn', 'course', 'teach', 'school', 'training', 'skill'],
  consumer: ['social', 'lifestyle', 'personal', 'home', 'family', 'daily'],
  b2b: ['enterprise', 'business', 'corporate', 'professional', 'workflow', 'productivity'],
};

function classifyVertical(idea: string): string {
  const lowerIdea = idea.toLowerCase();
  for (const [vertical, keywords] of Object.entries(VERTICAL_KEYWORDS)) {
    if (keywords.some((kw) => lowerIdea.includes(kw))) {
      return vertical;
    }
  }
  return 'other';
}

export function VerticalPerformanceTable({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);

  const verticalData = sprints.reduce((acc: any, sprint: any) => {
    const vertical = classifyVertical(sprint.idea);
    if (!acc[vertical]) {
      acc[vertical] = {
        vertical,
        count: 0,
        totalCtr: 0,
        totalCpc: 0,
        goCount: 0,
        totalGenomeScore: 0,
      };
    }
    acc[vertical].count++;
    const ctr = sprint.campaign?.angle_metrics?.blended_ctr || 0;
    const cpc = sprint.campaign?.angle_metrics?.blended_cpc_cents || 0;
    acc[vertical].totalCtr += ctr;
    acc[vertical].totalCpc += cpc;
    if (sprint.verdict?.aggregate_verdict === 'GO') {
      acc[vertical].goCount++;
    }
    const genomeScore = sprint.genome?.composite_score || 0;
    acc[vertical].totalGenomeScore += genomeScore;
    return acc;
  }, {});

  const tableData = Object.values(verticalData)
    .map((v: any) => ({
      vertical: v.vertical,
      sprintCount: v.count,
      avgCtr: v.count > 0 ? (v.totalCtr / v.count) * 100 : 0,
      avgCpc: v.count > 0 ? v.totalCpc / v.count / 100 : 0,
      goRate: v.count > 0 ? (v.goCount / v.count) * 100 : 0,
      avgGenomeScore: v.count > 0 ? v.totalGenomeScore / v.count : 0,
    }))
    .filter((v: any) => v.sprintCount > 0)
    .sort((a: any, b: any) => b.goRate - a.goRate);

  if (isLoading) {
    return (
      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 16, color: C.ink }}>Vertical Performance</h3>
        <div className="h-[250px] bg-faint rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 16, color: C.ink }}>Vertical Performance</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: C.muted }}>Vertical</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, color: C.muted }}>Sprints</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, color: C.muted }}>Avg CTR</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, color: C.muted }}>Avg CPC</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, color: C.muted }}>GO Rate</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, color: C.muted }}>Avg Genome</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row: any) => (
              <tr key={row.vertical} style={{ borderBottom: `1px solid ${C.border}50` }}>
                <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{row.vertical}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px' }}>{row.sprintCount}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px' }}>{row.avgCtr.toFixed(2)}%</td>
                <td style={{ textAlign: 'right', padding: '8px 12px' }}>${row.avgCpc.toFixed(2)}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px' }}>{row.goRate.toFixed(1)}%</td>
                <td style={{ textAlign: 'right', padding: '8px 12px' }}>{row.avgGenomeScore.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
