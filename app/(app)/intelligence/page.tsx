'use client';

import { useState } from 'react';
import { IntelligenceDashboard } from '@/components/intelligence/intelligence-dashboard';
import { PredictionEngine } from '@/components/intelligence/prediction-engine';
import { useAppStore } from '@/lib/store';

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState('market-overview');
  const orgId = useAppStore((state) => state.orgId);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-primary)', padding: '16px' }}>
      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
            Investor Intelligence
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Track your sprint performance, genome accuracy, and market insights.
          </p>
        </div>

        {/* Terminal-style tab switcher */}
        <div style={{ borderBottom: '1px solid var(--surface-border)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            <button
              onClick={() => setActiveTab('market-overview')}
              style={{
                padding: '12px 0',
                background: 'transparent',
                border: 'none',
                fontSize: '13px',
                fontWeight: 500,
                color: activeTab === 'market-overview' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                borderBottom: activeTab === 'market-overview' ? '2px solid var(--signal-go)' : 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
              }}
            >
              MARKET OVERVIEW
            </button>
            <button
              onClick={() => setActiveTab('prediction-engine')}
              style={{
                padding: '12px 0',
                background: 'transparent',
                border: 'none',
                fontSize: '13px',
                fontWeight: 500,
                color: activeTab === 'prediction-engine' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                borderBottom: activeTab === 'prediction-engine' ? '2px solid var(--signal-go)' : 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
              }}
            >
              PREDICTION ENGINE
            </button>
          </div>
        </div>

        {activeTab === 'market-overview' && <IntelligenceDashboard />}
        {activeTab === 'prediction-engine' && <PredictionEngine />}
      </div>
    </div>
  );
}
