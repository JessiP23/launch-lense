'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { GenomeOutput } from '@/lib/prompts';

// ── Agent pipeline definition ──────────────────────────────────────────────

type AgentStatus = 'waiting' | 'running' | 'done' | 'error';
interface AgentStep {
  id: string;
  icon: React.ReactNode;
  agent: string;
  action: string;
  dataSource: string;      // WHERE the model looks
  reasoning?: string;      // WHAT it actually found (from LLM response)
  metric: 'search_volume' | 'competitor_density' | 'language_fit' | 'orchestrator' | 'parser';
  status: AgentStatus;
  result?: string;
}

const AGENT_PIPELINE: Omit<AgentStep, 'status' | 'result' | 'reasoning'>[] = [
  {
    id: 'parser',
    icon: null,
    agent: 'Idea Parser',
    action: 'Extracting keywords, vertical, and buyer intent',
    dataSource: 'Llama 3 · semantic decomposition of your input',
    metric: 'parser',
  },
  {
    id: 'market',
    icon: null,
    agent: 'Market Signal Agent',
    action: 'Identifying buyer search terms + estimating monthly volume',
    dataSource: 'Llama 3 training data — Google Trends & SemRush category patterns up to early 2024',
    metric: 'search_volume',
  },
  {
    id: 'competitor',
    icon: null,
    agent: 'Competitor Intelligence Agent',
    action: 'Naming companies running paid ads, rating niche saturation',
    dataSource: 'Llama 3 training data — Meta Ad Library & Google Ads landscape up to early 2024',
    metric: 'competitor_density',
  },
  {
    id: 'language',
    icon: null,
    agent: 'Language–Market Fit Agent',
    action: 'Scoring how well your wording matches buyer search behavior',
    dataSource: 'Llama 3 training data — SERP intent & buyer keyword patterns',
    metric: 'language_fit',
  },
  {
    id: 'orchestrator',
    icon: null,
    agent: 'Verdict Orchestrator',
    action: 'Synthesizing signals into GO / NO-GO + pivot suggestion',
    dataSource: 'Weighted scoring model (Llama 3 · Groq)',
    metric: 'orchestrator',
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function NewTestPage() {
  const router = useRouter();
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenomeOutput | null>(null);
  const [analyzedIdea, setAnalyzedIdea] = useState('');
  const [agentLog, setAgentLog] = useState<AgentStep[]>([]);
  const [traceOpen, setTraceOpen] = useState(false); // kept for compat
  const [override, setOverride] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const runGenome = async () => {
    if (!idea.trim()) return;
    setLoading(true);
    setResult(null);
    setOverride(false);
    setTraceOpen(false);
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const initLog: AgentStep[] = AGENT_PIPELINE.map((s) => ({ ...s, status: 'waiting' }));
    setAgentLog(initLog);

    const setStep = (idx: number, status: AgentStatus, res?: string) =>
      setAgentLog((prev) => prev.map((s, i) => i === idx ? { ...s, status, result: res } : s));

    AGENT_PIPELINE.forEach((_, idx) => {
      if (idx === AGENT_PIPELINE.length - 1) return;
      const t = setTimeout(() => {
        setStep(idx, 'running');
        const done = setTimeout(() => setStep(idx, 'done'), 650);
        timers.current.push(done);
      }, idx * 750);
      timers.current.push(t);
    });

    const orchT = setTimeout(() => setStep(AGENT_PIPELINE.length - 1, 'running'), (AGENT_PIPELINE.length - 1) * 750);
    timers.current.push(orchT);

    try {
      const res = await fetch('/api/ai/genome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: idea.trim() }),
      });
      const data: GenomeOutput = await res.json();

      // Wire per-agent reasoning from LLM response into the trace
      setAgentLog((prev) => prev.map((s) => {
        const reasoning =
          s.metric === 'search_volume' ? data.step1_keywords :
          s.metric === 'competitor_density' ? data.step2_competitors :
          s.metric === 'language_fit' ? data.step3_language :
          s.metric === 'orchestrator' ? data.reasoning_1_sentence :
          undefined;

        const result =
          s.metric === 'search_volume' ? `${data.search_volume_monthly >= 1000 ? (data.search_volume_monthly / 1000).toFixed(1) + 'K' : data.search_volume_monthly}/mo` :
          s.metric === 'competitor_density' ? `${data.competitor_ad_density_0_10.toFixed(1)}/10` :
          s.metric === 'language_fit' ? `${Math.round(data.language_market_fit_0_100)}/100` :
          s.metric === 'orchestrator' ? data.verdict :
          undefined;

        return { ...s, status: 'done', result, reasoning };
      }));

      setResult(data);
      setAnalyzedIdea(idea.trim());
    } catch (err) {
      console.error('[genome]', err);
      setAgentLog((prev) => prev.map((s) => s.status === 'running' ? { ...s, status: 'error' } : s));
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!result) return;
    setContinuing(true);
    try {
      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: analyzedIdea, genome: result }),
      });
      const data = await res.json();
      if (data.id) {
        // Cache idea + genome in sessionStorage so the setup page loads instantly
        sessionStorage.setItem(`test:${data.id}`, JSON.stringify({ idea: analyzedIdea, genome: result }));
        router.push(`/tests/${data.id}/setup`);
      }
    } catch (err) {
      console.error('[create test]', err);
      setContinuing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div>
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[#8C8880] mb-1">
          Tests
        </p>
        <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.03em] text-[#111110]">
          New Test
        </h1>
        <p className="text-[0.875rem] text-[#8C8880] mt-1">
          Phase 0 — Genome pre-qualification. Kill bad ideas before spending a dollar.
        </p>
      </div>

      {/* Idea input */}
      <div className="bg-white rounded-xl border border-[#E8E4DC] p-5 space-y-4">
        <div>
          <p className="font-display text-[1.0625rem] font-bold tracking-[-0.01em] text-[#111110]">
            Describe your idea
          </p>
          <p className="text-[0.8125rem] text-[#8C8880] mt-0.5">
            A 5-agent pipeline queries Google Search and Meta Ad Library for live signals, then uses Llama 3 (Groq) to score the results.
          </p>
        </div>
        <Textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="e.g., AI-powered scheduling software for dental practices"
          rows={3}
          disabled={loading}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runGenome(); }}
          className="border-[#E8E4DC] bg-[#FAFAF8] focus:ring-[#111110]/10 text-[#111110] placeholder:text-[#8C8880]/60 resize-none"
        />
        <div className="flex items-center justify-between">
          <Button
            onClick={runGenome}
            disabled={!idea.trim() || loading}
            className="h-9 px-5 rounded-full bg-[#111110] text-white text-[0.875rem] font-medium hover:bg-[#111110]/90 border-0 disabled:opacity-40"
          >
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Analyzing…</>
            ) : (
              'Run'
            )}
          </Button>
        </div>
      </div>

      {/* Agent pipeline (running state) */}
      <AnimatePresence>
        {agentLog.length > 0 && loading && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-xl border border-[#E8E4DC] p-4 space-y-1"
          >
            <div className="flex items-center gap-2 mb-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8C8880]" />
              <span className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880]">
                Agent Pipeline · Running
              </span>
            </div>
            {agentLog.map((step) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors ${
                  step.status === 'running' ? 'bg-[#F3F0EB]' : ''
                }`}
              >
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                  step.status === 'done'    ? 'border-[#059669] text-[#059669]' :
                  step.status === 'running' ? 'border-[#111110] text-[#111110]' :
                  step.status === 'error'   ? 'border-[#DC2626] text-[#DC2626]' :
                                              'border-[#E8E4DC] text-[#8C8880]'
                }`}>
                  {step.status === 'done'    ? <CheckCircle2 className="w-3 h-3" /> :
                   step.status === 'running' ? <Loader2 className="w-3 h-3 animate-spin" /> :
                   step.status === 'error'   ? <XCircle className="w-3 h-3" /> :
                   <span className="w-1.5 h-1.5 rounded-full bg-[#E8E4DC] inline-block" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[0.8125rem] font-medium ${
                      step.status === 'waiting' ? 'text-[#8C8880]' : 'text-[#111110]'
                    }`}>
                      {step.agent}
                    </span>
                    {step.status === 'running' && (
                      <span className="text-[0.6875rem] text-[#8C8880] animate-pulse">running…</span>
                    )}
                    {step.result && (
                      <span className="text-[0.6875rem] font-mono text-[#8C8880] ml-auto">{step.result}</span>
                    )}
                  </div>
                  <p className="text-[0.75rem] text-[#8C8880] truncate">{step.action}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Analyzed idea label */}
            <p className="text-[0.75rem] text-[#8C8880] px-1">
              Analyzed: <em className="text-[#111110]">&ldquo;{analyzedIdea}&rdquo;</em>
            </p>

            {/* Verdict banner */}
            <div className={`p-5 rounded-xl border ${
              result.verdict === 'GO' || override
                ? 'border-[#059669]/20 bg-[#ECFDF5]'
                : 'border-[#DC2626]/20 bg-[#FEF2F2]'
            }`}>
              <p className={`font-display text-[1.375rem] font-bold tracking-[-0.02em] ${
                result.verdict === 'GO' ? 'text-[#059669]' : override ? 'text-[#D97706]' : 'text-[#DC2626]'
              }`}>
                {result.verdict === 'GO' ? '✓ GO — Launch it' : override ? 'Override — proceed with caution' : '✗ NO-GO — Bad signal'}
              </p>
              <p className="text-[0.875rem] text-[#8C8880] mt-1.5 max-w-lg">{result.reasoning_1_sentence}</p>
              <span className="inline-block mt-2 text-[0.6875rem] font-mono text-[#8C8880] border border-[#E8E4DC] bg-white px-2 py-0.5 rounded">
                Phase 0
              </span>
            </div>

            {/* Data source badge */}
            <p className={`text-[0.75rem] font-mono px-1 ${
              result.data_source === 'real' ? 'text-[#059669]' : 'text-[#8C8880]'
            }`}>
              {result.data_source === 'real'
                ? '⬤ Live data — Google Search + Meta Ad Library'
                : '◯ Estimate — add SERPER_API_KEY for live data'}
            </p>

            {/* 3 metric cards */}
            <div className="space-y-3">

              {/* Search Volume */}
              <div className="bg-white rounded-xl border border-[#E8E4DC] overflow-hidden">
                <div className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-1">
                      Search Volume / mo
                    </p>
                    <p className="text-[2rem] font-mono font-bold text-[#111110] tabular-nums">
                      {result.search_volume_monthly >= 1000
                        ? `${(result.search_volume_monthly / 1000).toFixed(1)}K`
                        : result.search_volume_monthly.toLocaleString()}
                    </p>
                    <div className="h-1 bg-[#F3F0EB] mt-2 rounded-full">
                      <div
                        className="h-full bg-[#111110] rounded-full"
                        style={{ width: `${Math.min(100, (result.search_volume_monthly / 50000) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-[0.75rem] font-mono text-[#8C8880] border border-[#E8E4DC] px-2 py-1 rounded whitespace-nowrap">
                    {result.search_volume_monthly >= 10000 ? 'Strong' : result.search_volume_monthly >= 1000 ? 'Moderate' : 'Weak'}
                  </span>
                </div>
                <div className="border-t border-[#E8E4DC] px-4 py-3 space-y-2 bg-[#FAFAF8]">
                  {result.source_google && (
                    <div className="space-y-1">
                      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[#8C8880]">
                        Raw — Google Search (live)
                      </p>
                      <div className="flex gap-4 text-[0.75rem]">
                        <span className="text-[#8C8880]">Pages: <span className="font-mono text-[#111110]">{result.source_google.organic_result_count.toLocaleString()}</span></span>
                        <span className="text-[#8C8880]">Google ads: <span className="font-mono text-[#111110]">{result.source_google.google_ads_count}</span></span>
                      </div>
                      {result.source_google.related_searches.length > 0 && (
                        <p className="text-[0.75rem] text-[#8C8880]">
                          Buyers search: <span className="text-[#111110]">{result.source_google.related_searches.slice(0, 5).join(' · ')}</span>
                        </p>
                      )}
                    </div>
                  )}
                  {result.step1_keywords && (
                    <p className="text-[0.75rem] text-[#8C8880] leading-relaxed border-l-2 border-[#E8E4DC] pl-3">
                      {result.step1_keywords}
                    </p>
                  )}
                </div>
              </div>

              {/* Competitor Density */}
              <div className="bg-white rounded-xl border border-[#E8E4DC] overflow-hidden">
                <div className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-1">
                      Ad Saturation
                    </p>
                    <p className="text-[2rem] font-mono font-bold text-[#111110] tabular-nums">
                      {result.competitor_ad_density_0_10.toFixed(1)}
                      <span className="text-[1.25rem] font-normal text-[#8C8880]"> /10</span>
                    </p>
                    <div className="h-1 bg-[#F3F0EB] mt-2 rounded-full">
                      <div
                        className="h-full bg-[#111110] rounded-full"
                        style={{ width: `${(result.competitor_ad_density_0_10 / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-[0.75rem] font-mono text-[#8C8880] border border-[#E8E4DC] px-2 py-1 rounded whitespace-nowrap">
                    {result.competitor_ad_density_0_10 <= 3 ? 'Blue ocean' : result.competitor_ad_density_0_10 <= 6 ? 'Moderate' : 'Saturated'}
                  </span>
                </div>
                <div className="border-t border-[#E8E4DC] px-4 py-3 space-y-2 bg-[#FAFAF8]">
                  {result.source_meta && result.source_meta.active_ads_count !== undefined && (
                    <div className="space-y-1">
                      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[#8C8880]">
                        Raw — Meta Ad Library (last 90 days)
                      </p>
                      <p className="text-[0.75rem] text-[#8C8880]">
                        Active ads: <span className="font-mono text-[#111110]">
                          {result.source_meta.active_ads_count}
                          {result.source_meta.active_ads_count === 25 ? ' (cap — saturated)' : ''}
                        </span>
                      </p>
                      {result.source_meta.advertiser_names && result.source_meta.advertiser_names.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {result.source_meta.advertiser_names.slice(0, 8).map((name) => (
                            <span key={name} className="text-[0.6875rem] px-1.5 py-0.5 bg-[#F3F0EB] border border-[#E8E4DC] rounded text-[#8C8880]">
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {result.step2_competitors && (
                    <p className="text-[0.75rem] text-[#8C8880] leading-relaxed border-l-2 border-[#E8E4DC] pl-3">
                      {result.step2_competitors}
                    </p>
                  )}
                </div>
              </div>

              {/* Language-Market Fit */}
              <div className="bg-white rounded-xl border border-[#E8E4DC] overflow-hidden">
                <div className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-1">
                      Language–Market Fit
                    </p>
                    <p className="text-[2rem] font-mono font-bold text-[#111110] tabular-nums">
                      {Math.round(result.language_market_fit_0_100)}
                      <span className="text-[1.25rem] font-normal text-[#8C8880]"> /100</span>
                    </p>
                    <div className="h-1 bg-[#F3F0EB] mt-2 rounded-full">
                      <div
                        className="h-full bg-[#111110] rounded-full"
                        style={{ width: `${result.language_market_fit_0_100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-[0.75rem] font-mono text-[#8C8880] border border-[#E8E4DC] px-2 py-1 rounded whitespace-nowrap">
                    {result.language_market_fit_0_100 >= 60 ? 'Strong fit' : result.language_market_fit_0_100 >= 40 ? 'Weak fit' : 'Poor fit'}
                  </span>
                </div>
                {result.step3_language && (
                  <div className="border-t border-[#E8E4DC] px-4 py-3 space-y-2 bg-[#FAFAF8]">
                    {result.source_google?.top_titles && result.source_google.top_titles.length > 0 && (
                      <div className="space-y-0.5">
                        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[#8C8880]">
                          Top Google results:
                        </p>
                        {result.source_google.top_titles.slice(0, 3).map((t) => (
                          <p key={t} className="text-[0.75rem] text-[#8C8880] truncate">— {t}</p>
                        ))}
                      </div>
                    )}
                    <p className="text-[0.75rem] text-[#8C8880] leading-relaxed border-l-2 border-[#E8E4DC] pl-3">
                      {result.step3_language}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Pivot suggestion */}
            {result.verdict === 'NO-GO' && result.pivot_suggestion_15_words && (
              <div className="p-4 rounded-xl border border-[#D97706]/20 bg-[#FFFBEB]">
                <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#D97706] mb-1.5">
                  Pivot Suggestion
                </p>
                <p className="text-[0.9375rem] font-medium text-[#111110]">
                  {result.pivot_suggestion_15_words}
                </p>
                <p className="text-[0.75rem] text-[#8C8880] mt-1">
                  Tweak your idea above and re-run Genome.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setResult(null); setAgentLog([]); setIdea(''); setOverride(false); }}
                  className="border-[#E8E4DC] text-[#111110] hover:bg-[#F3F0EB]"
                >
                  Start Over
                </Button>
                {result.verdict === 'NO-GO' && !override && (
                  <button
                    className="text-[0.8125rem] text-[#8C8880] underline underline-offset-2 hover:text-[#111110]"
                    onClick={() => setOverride(true)}
                  >
                    Override — proceed anyway
                  </button>
                )}
              </div>
              {(result.verdict === 'GO' || override) && (
                <Button
                  onClick={handleContinue}
                  disabled={continuing}
                  className="h-9 px-5 rounded-full bg-[#111110] text-white text-[0.875rem] font-medium hover:bg-[#111110]/90 border-0 disabled:opacity-40"
                >
                  {continuing ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Creating…</>
                  ) : (
                    'Continue to Setup →'
                  )}
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
