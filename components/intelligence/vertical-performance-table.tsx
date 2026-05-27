'use client';

import { useIntelligence } from '@/hooks/use-intelligence';

const VERTICAL_KEYWORDS: Record<string, string[]> = {
  fintech: ['bank', 'finance', 'payment', 'crypto', 'trading', 'invest', 'loan', 'credit', 'insurance'],
  health: ['health', 'medical', 'doctor', 'wellness', 'fitness', 'therapy', 'pharma', 'patient', 'mental'],
  saas: ['software', 'platform', 'tool', 'app', 'dashboard', 'analytics', 'automation', 'api', 'workflow'],
  ecommerce: ['shop', 'store', 'market', 'sell', 'buy', 'retail', 'commerce', 'product', 'marketplace'],
  consumer: ['social', 'lifestyle', 'personal', 'home', 'family', 'daily', 'app', 'community'],
  b2b: ['enterprise', 'business', 'corporate', 'professional', 'team', 'company', 'B2B'],
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
      <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          VERTICAL PERFORMANCE
        </div>
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--surface-border)' }}>
      <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        VERTICAL PERFORMANCE
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                VERTICAL
              </th>
              <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                SPRINTS
              </th>
              <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                GO RATE
              </th>
              <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                AVG CTR
              </th>
              <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                AVG CPC
              </th>
              <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                AVG GENOME
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row: any) => (
              <tr
                key={row.vertical}
                style={{ borderBottom: '1px solid var(--surface-border)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-elevated)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '12px 16px', textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                  {row.vertical}
                </td>
                <td style={{ textAlign: 'right', padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {row.sprintCount}
                </td>
                <td style={{ textAlign: 'right', padding: '12px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginBottom: 4 }}>
                    {row.goRate.toFixed(1)}%
                  </div>
                  <div style={{ width: `${row.goRate}%`, maxWidth: '60px', height: '2px', background: 'var(--signal-go)', opacity: 0.3, marginLeft: 'auto' }} />
                </td>
                <td style={{ textAlign: 'right', padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {row.avgCtr.toFixed(2)}%
                </td>
                <td style={{ textAlign: 'right', padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  ${row.avgCpc.toFixed(2)}
                </td>
                <td style={{ textAlign: 'right', padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {row.avgGenomeScore.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
