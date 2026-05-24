'use client';

import { useIntelligence } from '@/hooks/use-intelligence';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

export function AccuracyByVerticalChart({ orgId }: { orgId: string | null }) {
  const { sprints, isLoading } = useIntelligence(orgId);

  // Calculate accuracy by vertical
  const verticalAccuracy = sprints.reduce((acc: any, sprint: any) => {
    const vertical = classifyVertical(sprint.idea);
    if (!acc[vertical]) {
      acc[vertical] = { matches: 0, total: 0 };
    }
    const genomeSignal = sprint.genome?.signal;
    const verdict = sprint.verdict?.aggregate_verdict;
    if (genomeSignal && verdict) {
      acc[vertical].total++;
      const mappedSignal = genomeSignal === 'STOP' ? 'NO-GO' : genomeSignal;
      if (mappedSignal === verdict) acc[vertical].matches++;
    }
    return acc;
  }, {});

  const chartData = Object.entries(verticalAccuracy)
    .map(([vertical, data]: [string, any]) => ({
      vertical,
      accuracy: data.total > 0 ? ((data.matches / data.total) * 100).toFixed(1) : 0,
      count: data.total,
    }))
    .filter((d: any) => d.count > 0)
    .sort((a: any, b: any) => parseFloat(b.accuracy) - parseFloat(a.accuracy));

  if (isLoading) {
    return (
      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 16, color: C.ink }}>Accuracy by Vertical</h3>
        <div style={{ height: 250, background: C.faint, borderRadius: 8 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 16, color: C.ink }}>Accuracy by Vertical</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="vertical" label={{ value: 'Vertical', position: 'insideBottom', offset: -5, fill: C.muted, fontSize: 12 }} stroke={C.muted} />
          <YAxis label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: C.muted, fontSize: 12 }} stroke={C.muted} />
          <Tooltip formatter={(value: any) => `${value}%`} contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8 }} />
          <Bar dataKey="accuracy" fill="#059669" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
