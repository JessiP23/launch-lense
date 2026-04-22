'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Search, ShieldCheck, BarChart2, GitMerge,
  FlaskConical, Loader2, CheckCircle2, XCircle,
  ArrowRight, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    icon: <Brain className="w-3.5 h-3.5" />,
    agent: 'Idea Parser',
    action: 'Extracting keywords, vertical, and buyer intent',
    dataSource: 'Llama 3 · semantic decomposition of your input',
    metric: 'parser',
  },
  {
    id: 'market',
    icon: <Search className="w-3.5 h-3.5" />,
    agent: 'Market Signal Agent',
    action: 'Identifying buyer search terms + estimating monthly volume',
    dataSource: 'Llama 3 training data — Google Trends & SemRush category patterns up to early 2024',
    metric: 'search_volume',
  },
  {
    id: 'competitor',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
    agent: 'Competitor Intelligence Agent',
    action: 'Naming companies running paid ads, rating niche saturation',
    dataSource: 'Llama 3 training data — Meta Ad Library & Google Ads landscape up to early 2024',
    metric: 'competitor_density',
  },
  {
    id: 'language',
    icon: <BarChart2 className="w-3.5 h-3.5" />,
    agent: 'Language–Market Fit Agent',
    action: 'Scoring how well your wording matches buyer search behavior',
    dataSource: 'Llama 3 training data — SERP intent & buyer keyword patterns',
    metric: 'language_fit',
  },
  {
    id: 'orchestrator',
    icon: <GitMerge className="w-3.5 h-3.5" />,
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
        <h1 className="text-2xl font-semibold">New Test</h1>
        <p className="text-sm text-[#4A4A4A] mt-1">
          Phase 0 — Genome pre-qualification. Kill bad ideas before spending a dollar.
        </p>
      </div>

      {/* Idea input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="w-4 h-4" />
            Describe your idea
          </CardTitle>
          <CardDescription>
            A 5-agent pipeline queries Google Search (Serper.dev) and Meta Ad Library for live signals, then uses Llama 3 (Groq) to interpret and score the results.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="e.g., AI-powered scheduling software for dental practices"
            rows={3}
            disabled={loading}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runGenome(); }}
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-[#3A3A3A]">⌘ Enter to run</p>
            <Button onClick={runGenome} disabled={!idea.trim() || loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing…</> : <><FlaskConical className="w-4 h-4 mr-2" />Run Genome</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Agent pipeline */}
      <AnimatePresence>
        {agentLog.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {loading ? (
              <div className="rounded-lg border border-[#222] bg-[#080808] p-4 space-y-1">
                <div className="flex items-center gap-2 mb-3">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#555]" />
                  <span className="text-xs text-[#555] font-medium uppercase tracking-wider">Agent Pipeline · Running</span>
                </div>
                {agentLog.map((step) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 py-1.5 px-2 rounded-md"
                    style={{ background: step.status === 'running' ? 'rgba(255,255,255,0.03)' : 'transparent' }}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] ${
                      step.status === 'done'    ? 'bg-[#1F1F1F] text-[#888]' :
                      step.status === 'running' ? 'bg-[#252525] text-[#FAFAFA]' :
                      step.status === 'error'   ? 'bg-[#1F1F1F] text-[#555]' :
                                                  'bg-[#151515] text-[#333]'
                    }`}>
                      {step.status === 'done'    ? <CheckCircle2 className="w-3 h-3" /> :
                       step.status === 'running' ? <Loader2 className="w-3 h-3 animate-spin" /> :
                       step.status === 'error'   ? <XCircle className="w-3 h-3" /> :
                       step.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${step.status === 'waiting' ? 'text-[#333]' : 'text-[#FAFAFA]'}`}>{step.agent}</span>
                        {step.status === 'running' && <span className="text-[10px] text-[#666] animate-pulse">running…</span>}
                        {step.result && <span className="text-[10px] font-mono text-[#A1A1A1] ml-auto">{step.result}</span>}
                      </div>
                      <div className="text-[10px] text-[#3A3A3A] truncate">{step.action}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : result && null}

          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Analyzed idea label */}
            <div className="text-xs text-[#3A3A3A] flex items-center gap-2 px-1">
              <FlaskConical className="w-3.5 h-3.5 shrink-0" />
              <span>Analyzed: <em className="text-[#555]">&ldquo;{analyzedIdea}&rdquo;</em></span>
            </div>

            {/* Verdict banner */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-[#262626] bg-[#0D0D0D]">
              <div className="flex items-center gap-3">
                {result.verdict === 'GO'
                  ? <CheckCircle2 className="w-6 h-6 text-[#FAFAFA]" />
                  : override
                    ? <AlertTriangle className="w-6 h-6 text-[#888]" />
                    : <XCircle className="w-6 h-6 text-[#555]" />
                }
                <div>
                  <div className="font-bold text-lg text-[#FAFAFA]">
                    {result.verdict === 'GO' ? '✓ GO — Launch it' : override ? 'Override — proceed with caution' : '✗ NO-GO — Bad signal'}
                  </div>
                  <div className="text-sm text-[#666] mt-0.5 max-w-lg">{result.reasoning_1_sentence}</div>
                </div>
              </div>
              <div className="text-[10px] font-mono text-[#444] border border-[#222] px-2 py-1 rounded">
                Phase 0
              </div>
            </div>

            {/* Data source badge */}
            <div className="flex items-center gap-2 px-1">
              <div className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                result.data_source === 'real'
                  ? 'border-[#2A2A2A] text-[#888] bg-[#111]'
                  : 'border-[#1E1E1E] text-[#444] bg-[#0A0A0A]'
              }`}>
                {result.data_source === 'real' ? '⬤ Live data — Google Search + Meta Ad Library' : '◯ Estimate — add SERPER_API_KEY for live data'}
              </div>
            </div>

            {/* 3 metric cards — each shows raw scraped data + LLM interpretation */}
            <div className="space-y-3">

              {/* Search Volume */}
              <div className="rounded-lg border border-[#1E1E1E] bg-[#0A0A0A] overflow-hidden">
                <div className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Search className="w-3.5 h-3.5 text-[#555]" />
                      <span className="text-xs text-[#555] uppercase tracking-wider">Search Volume / mo</span>
                    </div>
                    <div className="text-3xl font-mono font-bold text-[#FAFAFA]">
                      {result.search_volume_monthly >= 1000
                        ? `${(result.search_volume_monthly / 1000).toFixed(1)}K`
                        : result.search_volume_monthly.toLocaleString()}
                    </div>
                    <div className="h-px bg-[#1A1A1A] mt-2 mb-1">
                      <div className="h-full bg-[#3A3A3A]" style={{ width: `${Math.min(100, (result.search_volume_monthly / 50000) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-xs font-mono text-[#444] border border-[#1E1E1E] px-2 py-1 rounded whitespace-nowrap">
                    {result.search_volume_monthly >= 10000 ? 'Strong' : result.search_volume_monthly >= 1000 ? 'Moderate' : 'Weak'}
                  </div>
                </div>
                <div className="border-t border-[#141414] px-4 py-3 space-y-2">
                  {/* Raw Google data */}
                  {result.source_google && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-[#3A3A3A] uppercase tracking-wider font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3A3A3A] inline-block" />
                        Raw data — Google Search (scraped live)
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                        <div className="text-[#555]">Indexed pages: <span className="text-[#888] font-mono">{result.source_google.organic_result_count.toLocaleString()}</span></div>
                        <div className="text-[#555]">Active Google ads: <span className="text-[#888] font-mono">{result.source_google.google_ads_count}</span></div>
                      </div>
                      {result.source_google.related_searches.length > 0 && (
                        <div className="text-[11px] text-[#555]">
                          Buyers search: <span className="text-[#777]">{result.source_google.related_searches.slice(0, 5).join(' · ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* LLM interpretation */}
                  {result.step1_keywords && (
                    <div className="text-[11px] text-[#666] leading-relaxed border-l border-[#222] pl-2.5">
                      {result.step1_keywords}
                    </div>
                  )}
                  <div className="text-[10px] text-[#2A2A2A]">
                    {result.source_google ? 'Source: Serper.dev → Google Search (live) · Interpreted by Llama 3 (Groq)' : 'Source: Llama 3 estimate (no SERPER_API_KEY configured)'}
                  </div>
                </div>
              </div>

              {/* Competitor Density */}
              <div className="rounded-lg border border-[#1E1E1E] bg-[#0A0A0A] overflow-hidden">
                <div className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#555]" />
                      <span className="text-xs text-[#555] uppercase tracking-wider">Ad Saturation</span>
                    </div>
                    <div className="text-3xl font-mono font-bold text-[#FAFAFA]">
                      {result.competitor_ad_density_0_10.toFixed(1)}<span className="text-lg text-[#444] font-normal"> /10</span>
                    </div>
                    <div className="h-px bg-[#1A1A1A] mt-2 mb-1">
                      <div className="h-full bg-[#3A3A3A]" style={{ width: `${(result.competitor_ad_density_0_10 / 10) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-xs font-mono text-[#444] border border-[#1E1E1E] px-2 py-1 rounded whitespace-nowrap">
                    {result.competitor_ad_density_0_10 <= 3 ? 'Blue ocean' : result.competitor_ad_density_0_10 <= 6 ? 'Moderate' : 'Saturated'}
                  </div>
                </div>
                <div className="border-t border-[#141414] px-4 py-3 space-y-2">
                  {result.source_meta && result.source_meta.active_ads_count !== undefined ? (
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-[#3A3A3A] uppercase tracking-wider font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3A3A3A] inline-block" />
                        Raw data — Meta Ad Library (scraped live, last 90 days)
                      </div>
                      <div className="text-[11px] text-[#555]">
                        Active ads found: <span className="text-[#888] font-mono">{result.source_meta.active_ads_count}{result.source_meta.active_ads_count === 25 ? ' (cap — market is saturated)' : ''}</span>
                      </div>
                      {result.source_meta.advertiser_names && result.source_meta.advertiser_names.length > 0 && (
                        <div>
                          <div className="text-[10px] text-[#333] mb-1">Advertisers in this space:</div>
                          <div className="flex flex-wrap gap-1">
                            {result.source_meta.advertiser_names.slice(0, 8).map((name) => (
                              <span key={name} className="text-[10px] px-1.5 py-0.5 bg-[#141414] border border-[#1E1E1E] rounded text-[#666]">{name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {result.step2_competitors && (
                    <div className="text-[11px] text-[#666] leading-relaxed border-l border-[#222] pl-2.5">
                      {result.step2_competitors}
                    </div>
                  )}
                  <div className="text-[10px] text-[#2A2A2A]">
                    {result.source_meta && result.source_meta.active_ads_count !== undefined
                      ? 'Source: Meta Ad Library API (live, graph.facebook.com) · Interpreted by Llama 3 (Groq)'
                      : 'Source: Llama 3 estimate (Meta API unavailable)'}
                  </div>
                </div>
              </div>

              {/* Language-Market Fit */}
              <div className="rounded-lg border border-[#1E1E1E] bg-[#0A0A0A] overflow-hidden">
                <div className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart2 className="w-3.5 h-3.5 text-[#555]" />
                      <span className="text-xs text-[#555] uppercase tracking-wider">Language–Market Fit</span>
                    </div>
                    <div className="text-3xl font-mono font-bold text-[#FAFAFA]">
                      {Math.round(result.language_market_fit_0_100)}<span className="text-lg text-[#444] font-normal"> /100</span>
                    </div>
                    <div className="h-px bg-[#1A1A1A] mt-2 mb-1">
                      <div className="h-full bg-[#3A3A3A]" style={{ width: `${result.language_market_fit_0_100}%` }} />
                    </div>
                  </div>
                  <div className="text-xs font-mono text-[#444] border border-[#1E1E1E] px-2 py-1 rounded whitespace-nowrap">
                    {result.language_market_fit_0_100 >= 60 ? 'Strong fit' : result.language_market_fit_0_100 >= 40 ? 'Weak fit' : 'Poor fit'}
                  </div>
                </div>
                {result.step3_language ? (
                  <div className="border-t border-[#141414] px-4 py-3 space-y-2">
                    <div className="text-[10px] text-[#3A3A3A] uppercase tracking-wider font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3A3A3A] inline-block" />
                      {result.source_google ? 'Derived from live Google search intent data' : 'LLM interpretation — no live data'}
                    </div>
                    {result.source_google && result.source_google.top_titles && result.source_google.top_titles.length > 0 && (
                      <div>
                        <div className="text-[10px] text-[#333] mb-1">Top results Google serves:</div>
                        <div className="space-y-0.5">
                          {result.source_google.top_titles.slice(0, 3).map((t) => (
                            <div key={t} className="text-[10px] text-[#555] truncate">— {t}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-[11px] text-[#666] leading-relaxed border-l border-[#222] pl-2.5">{result.step3_language}</div>
                    <div className="text-[10px] text-[#2A2A2A]">
                      {result.source_google ? 'Source: Serper.dev → Google (live) · Language fit scored by Llama 3 (Groq)' : 'Source: Llama 3 estimate (no live Google data)'}
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-[#141414] px-4 py-2 text-[10px] text-[#2A2A2A]">
                    Source: Llama 3 · Language–Market Fit Agent
                  </div>
                )}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="text-[10px] text-[#2A2A2A] leading-relaxed px-1">
              {result.data_source === 'real'
                ? '⬤ Search volume + ad competition pulled live from Google (Serper.dev) and Meta Ad Library. Language fit scored by Llama 3 (Groq) interpreting that data.'
                : '◯ No SERPER_API_KEY configured — all metrics are Llama 3 training-data estimates. Add the key to .env for live Google + Meta data.'
              }
            </div>

            {/* Pivot suggestion */}
            {result.verdict === 'NO-GO' && result.pivot_suggestion_15_words && (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-[#222] bg-[#0A0A0A]">
                <RefreshCw className="w-4 h-4 text-[#666] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-[#555] font-semibold uppercase tracking-wider mb-1">Pivot Suggestion</div>
                  <div className="text-sm font-medium text-[#FAFAFA]">{result.pivot_suggestion_15_words}</div>
                  <div className="text-xs text-[#444] mt-1">Tweak your idea above and re-run Genome.</div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => { setResult(null); setAgentLog([]); setIdea(''); setOverride(false); }}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Start Over
                </Button>
                {result.verdict === 'NO-GO' && !override && (
                  <button className="text-xs text-[#444] underline underline-offset-2 hover:text-[#888]" onClick={() => setOverride(true)}>
                    Override — proceed anyway
                  </button>
                )}
              </div>
              {(result.verdict === 'GO' || override) && (
                <Button onClick={handleContinue} disabled={continuing}>
                  {continuing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : <>Continue to Setup <ArrowRight className="w-4 h-4 ml-2" /></>}
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
