'use client';

import { useState } from 'react';
import { IntelligenceDashboard } from '@/components/intelligence/intelligence-dashboard';
import { PredictionEngine } from '@/components/intelligence/prediction-engine';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink-1 mb-2">Investor Intelligence</h1>
          <p className="text-sm text-ink-3">Track your sprint performance, genome accuracy, and market insights.</p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-border mb-6">
            <TabsList className="h-10 bg-transparent">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="prediction">Prediction Engine</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="dashboard" className="mt-0">
            <IntelligenceDashboard />
          </TabsContent>
          <TabsContent value="prediction" className="mt-0">
            <PredictionEngine />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
