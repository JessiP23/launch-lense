'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';

const STAGES = [
  { id: 'research', label: 'Research' },
  { id: 'readiness', label: 'Readiness' },
  { id: 'angles', label: 'Angles' },
  { id: 'creative', label: 'Creative' },
  { id: 'landing', label: 'Landing' },
  { id: 'campaign', label: 'Campaign' },
  { id: 'verdict', label: 'Verdict' },
];

type StageStatus = 'pending' | 'running' | 'done' | 'blocked';

interface SprintEvent {
  agent: string;
  event_type: string;
  payload?: Record<string, unknown>;
  created_at: string;
}

interface SprintData {
  sprint_id: string;
  idea: string;
  state: string;
  created_at: string;
  updated_at: string;
  verdict?: {
    verdict: string;
    confidence: number;
    recommended_channel: string;
    vertical_sample_size?: number;
  };
  events?: SprintEvent[];
  blocked_reason?: string;
}

export default function SprintStatusPage() {
  const params = useParams();
  const router = useRouter();
  const sprintId = params.id as string;

  const { data: sprint, error } = useSWR<SprintData>(
    `/api/sprint/${sprintId}`,
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch sprint');
      return res.json();
    },
    { refreshInterval: 8000 }
  );

  const [stageStatus, setStageStatus] = useState<Record<string, StageStatus>>(() => {
    const initial: Record<string, StageStatus> = {};
    STAGES.forEach((s) => (initial[s.id] = 'pending'));
    return initial;
  });

  useEffect(() => {
    if (!sprint) return;

    const stateToStage: Record<string, Record<string, StageStatus>> = {
      IDLE: { research: 'pending' },
      GENOME_RUNNING: { research: 'running' },
      GENOME_DONE: { research: 'done', readiness: 'pending' },
      HEALTHGATE_RUNNING: { research: 'done', readiness: 'running' },
      HEALTHGATE_DONE: { research: 'done', readiness: 'done', angles: 'pending' },
      PAYMENT_PENDING: { research: 'done', readiness: 'done', angles: 'pending' },
      ANGLES_RUNNING: { research: 'done', readiness: 'done', angles: 'running' },
      ANGLES_DONE: { research: 'done', readiness: 'done', angles: 'done', creative: 'pending' },
      USER_REVIEW_REQUIRED: { research: 'done', readiness: 'done', angles: 'done', creative: 'pending' },
      CREATIVE_APPROVED: { research: 'done', readiness: 'done', angles: 'done', creative: 'done', landing: 'pending' },
      LANDING_RUNNING: { research: 'done', readiness: 'done', angles: 'done', creative: 'done', landing: 'running' },
      LANDING_DONE: { research: 'done', readiness: 'done', angles: 'done', creative: 'done', landing: 'done', campaign: 'pending' },
      CAMPAIGN_CREATING: { research: 'done', readiness: 'done', angles: 'done', creative: 'done', landing: 'done', campaign: 'running' },
      CAMPAIGN_RUNNING: { research: 'done', readiness: 'done', angles: 'done', creative: 'done', landing: 'done', campaign: 'running' },
      CAMPAIGN_MONITORING: { research: 'done', readiness: 'done', angles: 'done', creative: 'done', landing: 'done', campaign: 'running' },
      VERDICT_GENERATING: { research: 'done', readiness: 'done', angles: 'done', creative: 'done', landing: 'done', campaign: 'done', verdict: 'running' },
      COMPLETE: { research: 'done', readiness: 'done', angles: 'done', creative: 'done', landing: 'done', campaign: 'done', verdict: 'done' },
      BLOCKED: { research: 'blocked', readiness: 'blocked', angles: 'blocked', creative: 'blocked', landing: 'blocked', campaign: 'blocked', verdict: 'blocked' },
    };

    setStageStatus(stateToStage[sprint.state] || stateToStage.IDLE);
  }, [sprint?.state]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <p className="text-zinc-400">Failed to load sprint</p>
      </div>
    );
  }

  if (!sprint) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const hours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (hours < 1) return 'Started just now';
    if (hours === 1) return 'Started 1 hour ago';
    return `Started ${hours} hours ago`;
  };

  const getStageStyle = (status: StageStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-zinc-900 border border-zinc-800 text-zinc-600';
      case 'running':
        return 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400';
      case 'done':
        return 'bg-zinc-800 border border-zinc-700 text-zinc-300';
      case 'blocked':
        return 'bg-red-500/10 border border-red-500/30 text-red-400';
      default:
        return 'bg-zinc-900 border border-zinc-800 text-zinc-600';
    }
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'GO':
        return 'text-emerald-400';
      case 'ITERATE':
        return 'text-amber-400';
      case 'NO-GO':
        return 'text-red-400';
      default:
        return 'text-zinc-400';
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await fetch(`/api/sprint/${sprintId}/report/pdf`);
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `launchlense-report-${sprintId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('PDF download failed:', err);
    }
  };

  const isComplete = sprint.state === 'COMPLETE';
  const isBlocked = sprint.state === 'BLOCKED';

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      <div className="max-w-3xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-zinc-300 text-lg font-medium truncate" title={sprint.idea}>
            {sprint.idea.slice(0, 80)}
            {sprint.idea.length > 80 ? '...' : ''}
          </h1>
          <p className="text-zinc-600 text-sm mt-1">{formatTimeAgo(sprint.created_at)}</p>
        </div>

        {/* Blocked State */}
        {isBlocked && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 mb-8">
            <p className="text-amber-300 text-sm">{sprint.blocked_reason || 'Sprint blocked'}</p>
            <button
              onClick={() => router.push('/launch')}
              className="mt-4 text-amber-400 text-sm hover:text-amber-300 transition-colors"
            >
              Contact support
            </button>
          </div>
        )}

        {/* Verdict Section (shown when COMPLETE) */}
        {isComplete && sprint.verdict && (
          <div className="bg-zinc-900 rounded-2xl p-8 text-center border border-zinc-800 mb-8">
            <h2 className={`text-6xl font-bold tracking-tight ${getVerdictColor(sprint.verdict.verdict)}`}>
              {sprint.verdict.verdict}
            </h2>
            <p className="text-zinc-400 text-lg mt-2">{sprint.verdict.confidence}% confidence</p>
            {sprint.verdict.recommended_channel && (
              <p className="text-zinc-500 text-sm mt-1">
                Best signal: {sprint.verdict.recommended_channel} at optimized performance
              </p>
            )}
            {sprint.verdict.vertical_sample_size && (
              <div className="mt-4">
                <span className="bg-zinc-800 px-3 py-1 rounded-full text-zinc-400 text-xs">
                  Calibrated against {sprint.verdict.vertical_sample_size} real sprints
                </span>
              </div>
            )}
          </div>
        )}

        {/* Pipeline Status Strip (hidden when COMPLETE) */}
        {!isComplete && (
          <div className="flex gap-2 flex-wrap mb-8">
            {STAGES.map((stage) => (
              <div
                key={stage.id}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${getStageStyle(stageStatus[stage.id])}`}
              >
                {stageStatus[stage.id] === 'running' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block mr-1.5" />
                )}
                {stageStatus[stage.id] === 'done' && <span className="mr-1.5">✓</span>}
                {stage.label}
              </div>
            ))}
          </div>
        )}

        {/* Live Activity Feed */}
        <div className="bg-zinc-900/50 rounded-xl p-4 font-mono text-xs mb-8">
          <h3 className="text-zinc-500 mb-3">Activity Feed</h3>
          <div className="space-y-2">
            {sprint.events && sprint.events.length > 0 ? (
              sprint.events.slice(0, 5).map((event, idx) => (
                <div
                  key={event.created_at}
                  className={`${idx === 0 ? 'text-zinc-300' : 'text-zinc-500'}`}
                >
                  <span className="mr-2">•</span>
                  {event.agent} — {event.event_type}
                  {event.payload && Object.keys(event.payload).length > 0 && (
                    <span className="text-zinc-600 ml-2">
                      ({JSON.stringify(event.payload).slice(0, 50)}...)
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-zinc-600">No events yet</p>
            )}
          </div>
        </div>

        {/* Report Download Button (shown when COMPLETE) */}
        {isComplete && (
          <button
            onClick={handleDownloadPDF}
            className="w-full max-w-sm mx-auto block h-12 bg-white text-black font-semibold text-sm rounded-xl hover:bg-zinc-100 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 outline-none"
          >
            Download Investor Report (PDF)
          </button>
        )}

        {/* Back to Launch */}
        <button
          onClick={() => router.push('/launch')}
          className="w-full text-zinc-500 text-sm text-center mt-6 hover:text-zinc-400 transition-colors"
        >
          ← Back to launch
        </button>
      </div>
    </div>
  );
}
