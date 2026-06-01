'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

export default function LaunchPage() {
  const router = useRouter();
  const [idea, setIdea] = useState('');
  const [budget, setBudget] = useState(500);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['meta']);
  const [isLaunching, setIsLaunching] = useState(false);

  const { data: sprintsData } = useSWR('/api/sprint', async (url) => {
    const res = await fetch(url);
    const data = await res.json();
    return data;
  });

  const channels = [
    { id: 'meta', label: 'Meta' },
    { id: 'google', label: 'Google' },
    { id: 'tiktok', label: 'TikTok' },
    { id: 'linkedin', label: 'LinkedIn' },
  ];

  const budgets = [250, 500, 1000, 2500];

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((c) => c !== channelId)
        : [...prev, channelId]
    );
  };

  const handleLaunch = async () => {
    if (!idea.trim()) return;
    setIsLaunching(true);

    try {
      // Create sprint
      const createRes = await fetch('/api/sprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: idea.trim(),
          budget_cents: budget * 100,
          channels: selectedChannels,
        }),
      });

      if (!createRes.ok) throw new Error('Failed to create sprint');

      const { sprint_id } = await createRes.json();

      // Start pipeline
      await fetch(`/api/sprint/${sprint_id}/run`, { method: 'POST' });

      router.push(`/launch/${sprint_id}`);
    } catch (err) {
      console.error('Launch failed:', err);
      setIsLaunching(false);
    }
  };

  const getVerdictBadge = (verdict: string) => {
    if (!verdict) return null;
    const colors = {
      GO: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      ITERATE: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      'NO-GO': 'bg-red-500/10 text-red-400 border-red-500/30',
    };
    const color = colors[verdict as keyof typeof colors] || colors.ITERATE;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
        {verdict}
      </span>
    );
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const hours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      <div className="max-w-2xl mx-auto mt-24 px-8">
        {/* Header */}
        <h1 className="text-white text-3xl font-semibold tracking-tight">
          Validate your idea in 48 hours
        </h1>
        <p className="text-zinc-400 text-base mt-2">
          We handle the ads. You get the verdict.
        </p>

        {/* Idea Input */}
        <div className="mt-8 relative">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Describe your startup idea. What problem does it solve, and who has it?"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-white text-base placeholder-zinc-600 min-h-[140px] resize-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 outline-none"
            maxLength={500}
          />
          <div className="absolute bottom-3 right-3 text-zinc-600 text-xs">
            {idea.length}/500
          </div>
        </div>

        {/* Options Row */}
        <div className="mt-4 flex gap-3 flex-wrap">
          {/* Budget Selector */}
          <select
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white text-sm focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 outline-none cursor-pointer"
          >
            {budgets.map((b) => (
              <option key={b} value={b}>
                ${b}
              </option>
            ))}
          </select>

          {/* Channel Pills */}
          <div className="flex gap-2 flex-wrap">
            {channels.map((channel) => {
              const isSelected = selectedChannels.includes(channel.id);
              return (
                <button
                  key={channel.id}
                  onClick={() => toggleChannel(channel.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                    isSelected
                      ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                      : 'border-zinc-700 text-zinc-400 bg-transparent hover:border-zinc-600'
                  }`}
                >
                  {channel.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Launch Button */}
        <button
          onClick={handleLaunch}
          disabled={!idea.trim() || isLaunching || selectedChannels.length === 0}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-semibold text-sm rounded-xl mt-6 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 outline-none"
        >
          {isLaunching ? 'Launching...' : 'Start 48-Hour Validation'}
        </button>

        <p className="text-zinc-600 text-xs text-center mt-3">
          We use our own ad accounts and budget — yours stays untouched.
        </p>

        {/* Previous Sprints */}
        {sprintsData?.sprints && sprintsData.sprints.length > 0 && (
          <div className="mt-16">
            <h2 className="text-zinc-500 text-sm mb-4">Your past sprints</h2>
            <div className="space-y-0">
              {sprintsData.sprints.slice(0, 5).map((sprint: any) => (
                <div
                  key={sprint.id}
                  className="flex items-center justify-between py-4 border-b border-zinc-900 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-300 text-sm truncate">
                      {sprint.idea.slice(0, 60)}
                      {sprint.idea.length > 60 ? '...' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    {getVerdictBadge(sprint.verdict?.verdict)}
                    <span className="text-zinc-500 text-xs">
                      {formatTimeAgo(sprint.created_at)}
                    </span>
                    {sprint.state === 'COMPLETE' && (
                      <button
                        onClick={() => router.push(`/launch/${sprint.id}`)}
                        className="text-zinc-400 text-xs hover:text-white transition-colors"
                      >
                        View Report
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
