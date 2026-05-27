'use client';

import { Lock, Sparkles } from 'lucide-react';

export function IntelligencePaywall() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-6">
      <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-6">
        <Lock className="w-8 h-8 text-ink-3" />
      </div>
      <h3 className="text-xl font-semibold text-ink-1 mb-3">Upgrade to Access Intelligence</h3>
      <p className="text-sm text-ink-3 max-w-md mb-6">
        Get detailed insights into your sprint performance, genome accuracy tracking, and market intelligence data.
      </p>
      <div className="bg-surface-1 border border-border rounded-lg p-4 mb-6 max-w-sm">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-ink-3" />
          <span className="text-sm font-medium text-ink-1">What you'll unlock:</span>
        </div>
        <ul className="text-sm text-ink-3 text-left space-y-1">
          <li>• Sprint performance analytics</li>
          <li>• Genome accuracy tracking</li>
          <li>• Vertical performance breakdown</li>
          <li>• Market intelligence feed</li>
          <li>• Prediction engine insights</li>
        </ul>
      </div>
      <button className="px-6 py-2.5 bg-ink-1 text-white rounded-lg text-sm font-medium hover:bg-ink-1/90 transition-colors">
        Upgrade Now
      </button>
    </div>
  );
}
