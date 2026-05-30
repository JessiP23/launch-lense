'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { SprintSignalRow } from '@/lib/signal-fabric';

const C = { ink: '#111110', muted: '#8C8880', border: '#E8E4DC', surface: '#FFFFFF', faint: '#F3F0EB' };

export function CalibrationAccuracyChart({ orgId }: { orgId: string | null }) {
  const [signals, setSignals] = useState<SprintSignalRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSignals() {
      try {
        const response = await fetch('/api/signal/signals?limit=100');
        const data = await response.json();
        setSignals(data.signals || []);
      } catch (err) {
        console.error('Failed to fetch sprint signals:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSignals();
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: C.muted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          CALIBRATION ACCURACY
        </div>
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13 }}>
          Loading...
        </div>
      </div>
    );
  }

  // Sort signals by created_at ascending for time series
  const sortedSignals = [...signals].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Calculate calibration accuracy per signal
  // Accuracy = 1 - |predicted_ctr - actual_ctr| / predicted_ctr
  const calibrationData = sortedSignals.map((signal, index) => {
    const actualCtr = signal.ctr ?? 0;
    const predictedCtr = 0.012; // Default benchmark CTR threshold (1.2%)
    
    // Calculate accuracy as percentage (clamped 0-100)
    const error = Math.abs(predictedCtr - actualCtr);
    const accuracy = Math.max(0, Math.min(100, (1 - error / predictedCtr) * 100));
    
    return {
      sprint: index + 1,
      accuracy: Math.round(accuracy),
      date: new Date(signal.created_at).toLocaleDateString(),
    };
  });

  // Calculate 10-sprint rolling average for trend line
  const windowSize = 10;
  const trendData = calibrationData.map((point, index) => {
    const window = calibrationData.slice(Math.max(0, index - windowSize + 1), index + 1);
    const avg = window.reduce((sum, p) => sum + p.accuracy, 0) / window.length;
    
    return {
      sprint: point.sprint,
      trend: Math.round(avg),
    };
  });

  // Calculate overall calibration accuracy
  const overallAccuracy = calibrationData.length > 0
    ? Math.round(calibrationData.reduce((sum, p) => sum + p.accuracy, 0) / calibrationData.length)
    : 0;

  return (
    <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          CALIBRATION ACCURACY
        </div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: C.ink }}>
          {overallAccuracy}% overall
        </div>
      </div>

      {calibrationData.length === 0 ? (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13 }}>
          No sprint signals recorded yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={calibrationData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis 
              dataKey="sprint" 
              tick={{ fill: C.muted, fontSize: 10 }}
              tickLine={{ stroke: C.border }}
              axisLine={{ stroke: C.border }}
            />
            <YAxis 
              domain={[0, 100]}
              tick={{ fill: C.muted, fontSize: 10 }}
              tickLine={{ stroke: C.border }}
              axisLine={{ stroke: C.border }}
              label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: C.muted, fontSize: 10 }}
            />
            <Tooltip 
              contentStyle={{ 
                background: C.surface, 
                border: `1px solid ${C.border}`, 
                borderRadius: 8,
                fontSize: 12,
                color: C.ink,
              }}
              formatter={(value: any, name: any) => [`${Number(value) ?? 0}%`, name === 'trend' ? 'Trend' : 'Accuracy']}
              labelFormatter={(label) => `Sprint ${label}`}
            />
            <Line 
              type="monotone" 
              dataKey="accuracy" 
              stroke="#0F8A4C" 
              strokeWidth={2}
              dot={{ fill: '#0F8A4C', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5 }}
              name="Accuracy"
            />
            <Line 
              type="monotone" 
              dataKey="trend" 
              data={trendData}
              stroke="#B17D00" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Trend"
            />
            <ReferenceLine y={70} stroke="#0F8A4C" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.5} />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
        <span style={{ color: '#0F8A4C', fontWeight: 600 }}>●</span> Per-sprint accuracy
        {' '}
        <span style={{ color: '#B17D00', fontWeight: 600 }}>— —</span> 10-sprint moving average
        {' '}
        (70% threshold)
      </div>
    </div>
  );
}
