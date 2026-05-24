'use client';

import { useState } from 'react';
import { IntelligenceDashboard } from '@/components/intelligence/intelligence-dashboard';
import { PredictionEngine } from '@/components/intelligence/prediction-engine';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <div className="border-b border-border px-6">
          <TabsList className="h-10 bg-transparent">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="prediction">Prediction Engine</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="dashboard" className="mt-0 h-full">
          <IntelligenceDashboard />
        </TabsContent>
        <TabsContent value="prediction" className="mt-0 h-full">
          <PredictionEngine />
        </TabsContent>
      </Tabs>
    </div>
  );
}
