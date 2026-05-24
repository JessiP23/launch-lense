'use client';

import { useState } from 'react';
import { IntelligenceDashboard } from '@/components/intelligence/intelligence-dashboard';
import { PredictionEngine } from '@/components/intelligence/prediction-engine';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const C = { ink: '#111110', muted: '#8C8880', border: '#E8E4DC', surface: '#FFFFFF', faint: '#F3F0EB' };

export function ExternalFeaturesPanel() {
  const [activeTab, setActiveTab] = useState('intelligence');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.surface }}>
      <Tabs value={activeTab} onValueChange={setActiveTab} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ borderBottom: `1px solid ${C.border}`, background: C.surface, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: C.ink, letterSpacing: '-0.02em' }}>External Features</h2>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: C.muted, background: C.faint, padding: '4px 10px', borderRadius: 6 }}>Beta</span>
          </div>
          <TabsList style={{ height: 36, background: 'transparent', width: '100%', justifyContent: 'flex-start' }}>
            <TabsTrigger value="intelligence" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Intelligence</TabsTrigger>
            <TabsTrigger value="market" style={{ fontSize: '0.875rem', fontWeight: 500 }} disabled>Market (Coming Soon)</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="intelligence" style={{ marginTop: 0, flex: 1, overflow: 'auto' }}>
          <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.ink, letterSpacing: '-0.02em', marginBottom: 8 }}>Investor Intelligence</h3>
              <p style={{ fontSize: '0.875rem', color: C.muted, lineHeight: 1.5 }}>Track sprint performance, genome accuracy, and market insights.</p>
            </div>
            <Tabs defaultValue="dashboard" style={{ width: '100%' }}>
              <div style={{ borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
                <TabsList style={{ height: 36, background: 'transparent' }}>
                  <TabsTrigger value="dashboard" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Dashboard</TabsTrigger>
                  <TabsTrigger value="prediction" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Prediction Engine</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="dashboard" style={{ marginTop: 0 }}>
                <IntelligenceDashboard />
              </TabsContent>
              <TabsContent value="prediction" style={{ marginTop: 0 }}>
                <PredictionEngine />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
