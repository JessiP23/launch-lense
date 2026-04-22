'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Search, ShieldCheck, BarChart2, GitMerge,
  FlaskConical, Loader2, CheckCircle2, XCircle, ChevronDown,
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
  const [traceOpen, setTraceOpen] = useState(false);
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
      if (data.id) router.push(`/tests/${data.id}/setup`);
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
            A 5-agent pipeline queries Llama 3 (Groq) for estimated search demand, named competitor advertisers, and language–market fit. All values are AI estimates from training-data patterns — not live API calls.
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
            ) : result && (
              /* Collapsible trace — shows WHERE and WHAT each agent found */
              <div className="rounded-lg border border-[#1E1E1E] overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-[#555] hover:text-[#888] hover:bg-[#0D0D0D] transition-colors"
                  onClick={() => setTraceOpen((v) => !v)}
                >
                  <span className="flex items-center gap-2">
                    <GitMerge className="w-3.5 h-3.5" />
                    Agent trace · 5 agents · all signals resolved
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${traceOpen ? 'rotate-180' : ''}`} />
                </button>
                {traceOpen && (
                  <div className="bg-[#080808] px-4 pb-4 space-y-4 border-t border-[#1A1A1A]">
                    {agentLog.map((step) => (
                      <div key={step.id} className="flex items-start gap-3 pt-3">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-[#1F1F1F] text-[#888] mt-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          {/* Agent name + result value */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-[#FAFAFA]">{step.agent}</span>
                            {step.result && (
                              <span className="text-[10px] font-mono text-[#888] px-1.5 py-0.5 bg-[#161616] border border-[#252525] rounded">
                                {step.result}
                              </span>
                            )}
                          </div>

                          {/* What the agent actually found (LLM chain-of-thought) */}
                          {step.reasoning && (
                            <div className="text-[11px] text-[#A1A1A1] leading-relaxed border-l-2 border-[#252525] pl-2.5">
                              {step.reasoning}
                            </div>
                          )}

                          {/* Data source */}
                          <div className="flex items-center gap-1 text-[10px] text-[#333]">
                            <span className="uppercase tracking-wider">Source:</span>
                            <span className="text-[#404040]">{step.dataSource}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-[#141414] text-[10px] text-[#2A2A2A] leading-relaxed">
                      These are AI-estimated directional signals derived from Llama 3 training-data patterns (pre-early 2024). They are not sourced from live APIs. Treat as a fast-filter, not a final market study.
                    </div>
                  </div>
                )}
              </div>
            )}
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

            {/* Verdict banner — monochrome */}
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

            {/* 3 metric cards — monochrome */}
            <div className="grid grid-cols-3 gap-3">
              {/* Search Volume */}
              <div className="p-4 rounded-lg border border-[#1E1E1E] bg-[#0A0A0A] space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-[#555]">
                  <Search className="w-3.5 h-3.5" />Search / mo
                </div>
                <div className="text-2xl font-mono font-bold text-[#FAFAFA]">
                  {result.search_volume_monthly >= 1000
                    ? `${(result.search_volume_monthly / 1000).toFixed(1)}K`
                    : result.search_volume_monthly.toLocaleString()}
                </div>
                <div className="text-[10px] text-[#444]">
                  {result.search_volume_monthly >= 10000 ? 'Strong demand' : result.search_volume_monthly >= 1000 ? 'Moderate demand' : 'Weak demand'}
                </div>
                <div className="h-px bg-[#1A1A1A] overflow-hidden">
                  <div className="h-full bg-[#3A3A3A]" style={{ width: `${Math.min(100, (result.search_volume_monthly / 50000) * 100)}%` }} />
                </div>
                <div className="text-[9px] text-[#2A2A2A]">Llama 3 · Market Signal Agent</div>
              </div>

              {/* Competitor density */}
              <div className="p-4 rounded-lg border border-[#1E1E1E] bg-[#0A0A0A] space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-[#555]">
                  <ShieldCheck className="w-3.5 h-3.5" />Ad Saturation
                </div>
                <div className="text-2xl font-mono font-bold text-[#FAFAFA]">
                  {result.competitor_ad_density_0_10.toFixed(1)}<span className="text-base text-[#444] font-normal"> /10</span>
                </div>
                <div className="text-[10px] text-[#444]">
                  {result.competitor_ad_density_0_10 <= 3 ? 'Blue ocean' : result.competitor_ad_density_0_10 <= 6 ? 'Moderate — winnable' : 'Saturated — high CPA'}
                </div>
                <div className="h-px bg-[#1A1A1A] overflow-hidden">
                  <div className="h-full bg-[#3A3A3A]" style={{ width: `${(result.competitor_ad_density_0_10 / 10) * 100}%` }} />
                </div>
                <div className="text-[9px] text-[#2A2A2A]">Llama 3 · Competitor Intelligence Agent</div>
              </div>

              {/* Language-market fit */}
              <div className="p-4 rounded-lg border border-[#1E1E1E] bg-[#0A0A0A] space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-[#555]">
                  <BarChart2 className="w-3.5 h-3.5" />Language Fit
                </div>
                <div className="text-2xl font-mono font-bold text-[#FAFAFA]">
                  {Math.round(result.language_market_fit_0_100)}<span className="text-base text-[#444] font-normal"> /100</span>
                </div>
                <div className="text-[10px] text-[#444]">
                  {result.language_market_fit_0_100 >= 60 ? 'Buyers use your words' : result.language_market_fit_0_100 >= 40 ? 'Weak fit — test messaging' : 'Poor fit — rethink positioning'}
                </div>
                <div className="h-px bg-[#1A1A1A] overflow-hidden">
                  <div className="h-full bg-[#3A3A3A]" style={{ width: `${result.language_market_fit_0_100}%` }} />
                </div>
                <div className="text-[9px] text-[#2A2A2A]">Llama 3 · Language–Market Fit Agent</div>
              </div>
            </div>

            {/* Pivot suggestion */}
            {result.verdict === 'NO-GO' && result.pivot_suggestion_15_words && (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-[#222] bg-[#0A0A0A]">
                <RefreshCw className="w-4 h-4 text-[#666] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-[#555] font-semibold uppercase tracking-wider mb-1">AI Pivot Suggestion</div>
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
