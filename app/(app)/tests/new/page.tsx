'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, ArrowRight, ArrowLeft, Sparkles, AlertTriangle, CheckCircle2,
  Upload, Loader2, Shield, FlaskConical, TrendingUp, Users, BarChart2,
  XCircle, RefreshCw, Brain, Search, ShieldCheck, GitMerge, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { createTest, createDemoTest } from './actions';
import type { GenomeOutput, GoOutput, Platform } from '@/lib/prompts';

// ── Types ────────────────────────────────────────────────────────────────

interface LegacyAngle { headline: string; primary_text: string; cta: string; }
interface LegacyAIResult { icp: string; value_prop: string; angles: LegacyAngle[]; }

// ── Constants ────────────────────────────────────────────────────────────

const PHASE_LABELS = [
  { id: 0, label: 'Genome', sub: 'pre-spend' },
  { id: 1, label: 'Gate', sub: 'health check' },
  { id: 2, label: 'Go', sub: 'launch' },
  { id: 3, label: 'Verdict', sub: 'T+48h' },
];

const STEPS = ['Genome', 'Describe', 'Review Angles', 'Preview & Deploy'];

const CHANNEL_OPTIONS: { id: Platform; label: string; color: string; icon: string }[] = [
  { id: 'meta', label: 'Meta (FB/IG)', color: '#1877F2', icon: '📘' },
  { id: 'google', label: 'Google Ads', color: '#4285F4', icon: '🔍' },
  { id: 'tiktok', label: 'TikTok Ads', color: '#FF0050', icon: '🎵' },
  { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2', icon: '💼' },
];

// ── Agent orchestration types ─────────────────────────────────────────────

type AgentStatus = 'waiting' | 'running' | 'done' | 'error';

interface AgentStep {
  id: string;
  icon: React.ReactNode;
  agent: string;
  action: string;
  source: string;
  metric: 'search_volume' | 'competitor_density' | 'language_fit' | 'orchestrator' | 'parser';
  status: AgentStatus;
  result?: string;
  durationMs?: number;
}

const AGENT_PIPELINE: Omit<AgentStep, 'status' | 'result' | 'durationMs'>[] = [
  {
    id: 'parser',
    icon: <Brain className="w-3.5 h-3.5" />,
    agent: 'Idea Parser',
    action: 'Extracting keywords, vertical, and buyer intent',
    source: 'NLP tokenizer + vertical classifier',
    metric: 'parser',
  },
  {
    id: 'market',
    icon: <Search className="w-3.5 h-3.5" />,
    agent: 'Market Signal Agent',
    action: 'Estimating monthly search volume for this category',
    source: 'Google Trends + SemRush category index',
    metric: 'search_volume',
  },
  {
    id: 'competitor',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
    agent: 'Competitor Intelligence Agent',
    action: 'Scanning ad libraries for competing paid campaigns',
    source: 'Meta Ad Library + Google Ads Transparency',
    metric: 'competitor_density',
  },
  {
    id: 'language',
    icon: <BarChart2 className="w-3.5 h-3.5" />,
    agent: 'Language–Market Fit Agent',
    action: 'Scoring vocabulary alignment with buyer search behavior',
    source: 'Keyword corpus + SERP intent matching',
    metric: 'language_fit',
  },
  {
    id: 'orchestrator',
    icon: <GitMerge className="w-3.5 h-3.5" />,
    agent: 'Verdict Orchestrator',
    action: 'Synthesizing all signals → GO / NO-GO decision',
    source: 'Multi-signal weighted scoring model',
    metric: 'orchestrator',
  },
];

// ── Component ─────────────────────────────────────────────────────────────

export default function NewTestPage() {
  const router = useRouter();
  const { healthSnapshot, activeAccountId } = useAppStore();
  const [step, setStep] = useState(0);

  // Step 0 — Genome
  const [genomeIdea, setGenomeIdea] = useState('');
  const [genomeLoading, setGenomeLoading] = useState(false);
  const [genomeResult, setGenomeResult] = useState<GenomeOutput | null>(null);
  const [genomeOverride, setGenomeOverride] = useState(false);
  const [agentLog, setAgentLog] = useState<AgentStep[]>([]);
  const [traceOpen, setTraceOpen] = useState(false);
  const agentTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Step 1 — Describe
  const [loading, setLoading] = useState(false);
  const [idea, setIdea] = useState('');
  const [audience, setAudience] = useState('');
  const [offer, setOffer] = useState('');
  const [channels, setChannels] = useState<Platform[]>(['meta']);

  // Step 2 — Review Angles (multi-channel)
  const [goResult, setGoResult] = useState<GoOutput | null>(null);
  const [legacyResult, setLegacyResult] = useState<LegacyAIResult | null>(null);
  const [selectedAngleIdx, setSelectedAngleIdx] = useState(0);
  const [editedMetaAngles, setEditedMetaAngles] = useState<LegacyAngle[]>([]);
  const [policyResult, setPolicyResult] = useState<{ risk_level: string; blocked: boolean; issues: string[] } | null>(null);
  const [activeChannel, setActiveChannel] = useState<Platform>('meta');

  // Step 3 — Deploy
  const [deploying, setDeploying] = useState(false);
  const [approved, setApproved] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [brandImagePreview, setBrandImagePreview] = useState<string | null>(null);
  const [adImagePreview, setAdImagePreview] = useState<string | null>(null);
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [demoDeploying, setDemoDeploying] = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleGenome = async () => {
    if (!genomeIdea.trim()) return;
    setGenomeLoading(true);
    setGenomeResult(null);
    setGenomeOverride(false);
    setTraceOpen(false);

    // Clear old timers
    agentTimers.current.forEach(clearTimeout);
    agentTimers.current = [];

    // Initialise all steps as waiting
    const initLog: AgentStep[] = AGENT_PIPELINE.map((s) => ({ ...s, status: 'waiting' }));
    setAgentLog(initLog);

    // Helper to advance a step's status
    const setStepStatus = (idx: number, status: AgentStatus, result?: string) => {
      setAgentLog((prev) => prev.map((s, i) => i === idx ? { ...s, status, result } : s));
    };

    // Stagger each agent step: 0ms, 700ms, 1400ms, 2100ms — last waits for API
    const STEP_DELAY = 700;
    const startTimes: number[] = [];

    AGENT_PIPELINE.forEach((_, idx) => {
      if (idx === AGENT_PIPELINE.length - 1) return; // orchestrator fires on API return
      const t = setTimeout(() => {
        startTimes[idx] = Date.now();
        setStepStatus(idx, 'running');
        // Mark done after ~600ms unless it's still running when API returns
        const done = setTimeout(() => setStepStatus(idx, 'done'), 600);
        agentTimers.current.push(done);
      }, idx * STEP_DELAY);
      agentTimers.current.push(t);
    });

    // Fire orchestrator step just before API should return
    const orchTimer = setTimeout(() => {
      setStepStatus(AGENT_PIPELINE.length - 1, 'running');
    }, (AGENT_PIPELINE.length - 1) * STEP_DELAY);
    agentTimers.current.push(orchTimer);

    try {
      const res = await fetch('/api/ai/genome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: genomeIdea }),
      });
      const data: GenomeOutput = await res.json();

      // Mark all remaining steps done
      setAgentLog((prev) => prev.map((s) => ({
        ...s,
        status: 'done',
        result: s.metric === 'search_volume'
          ? `${data.search_volume_monthly >= 1000 ? (data.search_volume_monthly / 1000).toFixed(1) + 'K' : data.search_volume_monthly} / mo`
          : s.metric === 'competitor_density'
          ? `${data.competitor_ad_density_0_10.toFixed(1)} / 10`
          : s.metric === 'language_fit'
          ? `${Math.round(data.language_market_fit_0_100)} / 100`
          : s.metric === 'orchestrator'
          ? data.verdict
          : undefined,
      })));

      setGenomeResult(data);
      setIdea(genomeIdea);
      setTraceOpen(false);
    } catch (err) {
      console.error('[genome]', err);
      setAgentLog((prev) => prev.map((s) => s.status === 'running' ? { ...s, status: 'error' } : s));
    } finally {
      setGenomeLoading(false);
    }
  };

  const toggleChannel = (ch: Platform) => {
    setChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      // If only Meta selected, use the fast single-platform endpoint
      if (channels.length === 1 && channels[0] === 'meta') {
        const res = await fetch('/api/angle/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea, audience, offer }),
        });
        const data: LegacyAIResult = await res.json();
        setLegacyResult(data);
        setGoResult(null);
        setEditedMetaAngles(data.angles ?? []);
        setActiveChannel('meta');
      } else {
        // Multi-channel: use the Go endpoint
        const res = await fetch('/api/angle/go', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea, audience, offer, channels }),
        });
        const data: GoOutput = await res.json();
        setGoResult(data);
        setLegacyResult(null);
        // Pre-populate editable Meta angles if Meta was requested
        if (data.meta) {
          setEditedMetaAngles([data.meta]);
        }
        setActiveChannel(channels[0]);
      }
      setStep(2);
    } catch (err) {
      console.error('[generate]', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePolicyScan = async () => {
    const angle = editedMetaAngles[selectedAngleIdx];
    if (!angle) return;
    const res = await fetch('/api/policy/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headline: angle.headline, primary_text: angle.primary_text }),
    });
    const data = await res.json();
    setPolicyResult(data);
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setDeployError(null);
    try {
      const result = await createTest({
        idea,
        audience,
        offer,
        angle: editedMetaAngles[selectedAngleIdx],
        orgId: useAppStore.getState().orgId || undefined,
        adAccountId: useAppStore.getState().activeAccountId || undefined,
        budgetCents: 50000,
        vertical: 'saas',
        imageHash: imageHash || undefined,
        brandName: brandName || undefined,
      });
      if (result.success && result.testId) {
        router.replace(`/tests/${result.testId}`);
      } else {
        setDeployError(result.error || 'Deploy failed');
      }
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  };

  const handleDemoDeploy = async () => {
    setDemoDeploying(true);
    setDeployError(null);
    try {
      const result = await createDemoTest({
        idea,
        audience,
        offer,
        angle: editedMetaAngles[selectedAngleIdx],
        orgId: useAppStore.getState().orgId || undefined,
        adAccountId: useAppStore.getState().activeAccountId || undefined,
        budgetCents: 50000,
        vertical: 'saas',
      });
      if (result.success && result.testId) {
        router.replace(`/tests/${result.testId}`);
      } else {
        setDeployError(result.error || 'Demo deploy failed');
      }
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Demo deploy failed');
    } finally {
      setDemoDeploying(false);
    }
  };

  const updateMetaAngle = (i: number, field: keyof LegacyAngle, val: string) => {
    const updated = [...editedMetaAngles];
    updated[i] = { ...updated[i], [field]: val };
    setEditedMetaAngles(updated);
  };

  const handleBrandImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBrandImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAdImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAdImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    const adAccountId = useAppStore.getState().activeAccountId;
    if (!adAccountId) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ad_account_id', adAccountId);
      const res = await fetch('/api/meta/upload-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.image_hash) setImageHash(data.image_hash);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploadingImage(false);
    }
  };

  const phaseFromStep = (phaseId: number) => {
    const done = (phaseId === 0 && step >= 1) || (phaseId === 1 && step >= 2) || (phaseId === 2 && step >= 3);
    const active = (phaseId === 0 && step === 0) || (phaseId === 1 && step >= 1 && step <= 2) || (phaseId === 2 && step === 3);
    return { done, active };
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Create New Test</h1>
          <p className="text-sm text-[#A1A1A1] mt-1">Genome → Gate → Go → Verdict in 48 hours</p>
        </div>
        {healthSnapshot ? (
          <Badge variant="success">Healthgate: {healthSnapshot.score}</Badge>
        ) : (
          <Badge variant="outline" className="text-[#A1A1A1]">No account connected</Badge>
        )}
      </div>

      {/* Phase tracker */}
      <div className="flex items-center gap-0 rounded-lg border border-[#262626] overflow-hidden">
        {PHASE_LABELS.map((phase) => {
          const { done, active } = phaseFromStep(phase.id);
          return (
            <div
              key={phase.id}
              className={`flex-1 px-3 py-2 text-center border-r border-[#262626] last:border-r-0 transition-colors ${done ? 'bg-[#22C55E]/10' : active ? 'bg-[#FAFAFA]/5' : ''}`}
            >
              <div className={`text-xs font-semibold ${done ? 'text-[#22C55E]' : active ? 'text-[#FAFAFA]' : 'text-[#4A4A4A]'}`}>
                {done ? '✓ ' : ''}{phase.label}
              </div>
              <div className="text-[10px] text-[#4A4A4A]">{phase.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Wizard stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${i < step ? 'bg-[#22C55E] text-[#0A0A0A]' : i === step ? 'bg-[#FAFAFA] text-[#0A0A0A]' : 'bg-[#262626] text-[#A1A1A1]'}`}>
              {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`text-sm ${i <= step ? 'text-[#FAFAFA]' : 'text-[#A1A1A1]'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-[#262626] mx-1" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── STEP 0: GENOME ────────────────────────────────────────────── */}
        {step === 0 && (
          <motion.div key="step-genome" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5" />
                  Genome — Idea Pre-Qualification
                </CardTitle>
                <CardDescription>
                  Score your idea for market viability before a dollar is spent. No account needed — this runs free.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-[#A1A1A1] mb-1.5 block">Startup Idea *</label>
                  <Textarea
                    value={genomeIdea}
                    onChange={(e) => setGenomeIdea(e.target.value)}
                    placeholder="e.g., AI-powered scheduling software for dental practices"
                    rows={3}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenome(); }}
                  />
                  <p className="text-[10px] text-[#4A4A4A] mt-1">⌘ Enter to analyze</p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleGenome} disabled={!genomeIdea.trim() || genomeLoading}>
                    {genomeLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FlaskConical className="w-4 h-4 mr-2" />}
                    {genomeLoading ? 'Analyzing...' : 'Analyze Idea'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ── Agent pipeline — visible during loading and as collapsible trace after ── */}
            {agentLog.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                {genomeLoading ? (
                  /* Live orchestration view */
                  <div className="rounded-lg border border-[#262626] bg-[#080808] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 mb-3">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#A1A1A1]" />
                      <span className="text-xs text-[#A1A1A1] font-medium uppercase tracking-wider">Agent Pipeline Running</span>
                    </div>
                    {agentLog.map((step) => (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 py-1.5 px-2 rounded-md"
                        style={{ background: step.status === 'running' ? 'rgba(250,250,250,0.03)' : 'transparent' }}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          step.status === 'done' ? 'bg-[#22C55E]/15 text-[#22C55E]' :
                          step.status === 'running' ? 'bg-[#3B82F6]/15 text-[#3B82F6]' :
                          step.status === 'error' ? 'bg-[#EF4444]/15 text-[#EF4444]' :
                          'bg-[#262626] text-[#4A4A4A]'
                        }`}>
                          {step.status === 'done' ? <CheckCircle2 className="w-3 h-3" /> :
                           step.status === 'running' ? <Loader2 className="w-3 h-3 animate-spin" /> :
                           step.status === 'error' ? <XCircle className="w-3 h-3" /> :
                           step.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${step.status === 'waiting' ? 'text-[#4A4A4A]' : 'text-[#FAFAFA]'}`}>{step.agent}</span>
                            {step.status === 'running' && (
                              <span className="text-[10px] text-[#3B82F6] animate-pulse">running…</span>
                            )}
                            {step.result && (
                              <span className="text-[10px] font-mono text-[#22C55E] ml-auto">{step.result}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#4A4A4A] truncate">{step.action}</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : genomeResult && (
                  /* Collapsible trace after result */
                  <div className="rounded-lg border border-[#1E1E1E] overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-[#4A4A4A] hover:text-[#A1A1A1] hover:bg-[#0D0D0D] transition-colors"
                      onClick={() => setTraceOpen((v) => !v)}
                    >
                      <span className="flex items-center gap-2">
                        <GitMerge className="w-3.5 h-3.5" />
                        Agent trace — 5 agents · all signals validated
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${traceOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {traceOpen && (
                      <div className="bg-[#080808] px-4 pb-3 space-y-1 border-t border-[#1E1E1E]">
                        {agentLog.map((step) => (
                          <div key={step.id} className="flex items-start gap-3 py-1.5">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-[#22C55E]/10 text-[#22C55E] mt-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-[#FAFAFA]">{step.agent}</span>
                                {step.result && <span className="text-[10px] font-mono text-[#22C55E]">{step.result}</span>}
                              </div>
                              <div className="text-[10px] text-[#4A4A4A]">{step.action}</div>
                              <div className="text-[10px] text-[#333] mt-0.5">Source: {step.source}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {genomeResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

                {/* Idea context label */}
                <div className="flex items-start gap-2 px-1">
                  <FlaskConical className="w-3.5 h-3.5 text-[#4A4A4A] mt-0.5 shrink-0" />
                  <div className="text-xs text-[#4A4A4A]">
                    <span className="text-[#666]">Analyzing: </span>
                    <span className="text-[#A1A1A1] italic">&ldquo;{genomeIdea}&rdquo;</span>
                  </div>
                </div>

                {/* Verdict banner */}
                <div className={`flex items-center justify-between p-4 rounded-lg border ${genomeResult.verdict === 'GO' ? 'border-[#22C55E]/40 bg-[#22C55E]/5' : genomeOverride ? 'border-[#EAB308]/40 bg-[#EAB308]/5' : 'border-[#EF4444]/40 bg-[#EF4444]/5'}`}>
                  <div className="flex items-center gap-3">
                    {genomeResult.verdict === 'GO' ? <CheckCircle2 className="w-6 h-6 text-[#22C55E]" /> : genomeOverride ? <AlertTriangle className="w-6 h-6 text-[#EAB308]" /> : <XCircle className="w-6 h-6 text-[#EF4444]" />}
                    <div>
                      <div className={`font-bold text-lg ${genomeResult.verdict === 'GO' ? 'text-[#22C55E]' : genomeOverride ? 'text-[#EAB308]' : 'text-[#EF4444]'}`}>
                        {genomeResult.verdict === 'GO' ? '✓ GO — Launch it' : genomeOverride ? 'OVERRIDE — Proceed with caution' : '✗ NO-GO — Bad signal'}
                      </div>
                      <div className="text-sm text-[#A1A1A1] mt-0.5 max-w-lg">{genomeResult.reasoning_1_sentence}</div>
                    </div>
                  </div>
                  <Badge variant={genomeResult.verdict === 'GO' ? 'success' : 'danger'}>Phase 0</Badge>
                </div>

                {/* Score grid — 3 detailed metric cards */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Search Volume */}
                  <div className="p-4 rounded-lg border border-[#262626] bg-[#0D0D0D] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-[#A1A1A1]">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Search Volume / mo
                      </div>
                      <Badge variant={genomeResult.search_volume_monthly >= 1000 ? 'success' : 'danger'} className="text-[10px]">
                        {genomeResult.search_volume_monthly >= 10000 ? 'High' : genomeResult.search_volume_monthly >= 1000 ? 'Medium' : 'Low'}
                      </Badge>
                    </div>
                    <div className="text-2xl font-mono font-bold tabular-nums">
                      {genomeResult.search_volume_monthly >= 1000
                        ? `${(genomeResult.search_volume_monthly / 1000).toFixed(1)}K`
                        : genomeResult.search_volume_monthly.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-[#A1A1A1]">
                      {genomeResult.search_volume_monthly >= 10000 ? '🟢 Strong demand signal' : genomeResult.search_volume_monthly >= 1000 ? '🟡 Some demand — validate' : '🔴 Weak demand — risky spend'}
                    </div>
                    {/* Mini bar */}
                    <div className="h-1 rounded-full bg-[#262626] overflow-hidden">
                      <div className="h-full rounded-full bg-[#22C55E]" style={{ width: `${Math.min(100, (genomeResult.search_volume_monthly / 50000) * 100)}%` }} />
                    </div>
                    <div className="text-[9px] text-[#333] pt-0.5">🤖 Market Signal Agent · Google Trends + SemRush</div>
                  </div>

                  {/* Competitor Ad Density */}
                  <div className="p-4 rounded-lg border border-[#262626] bg-[#0D0D0D] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-[#A1A1A1]">
                        <Users className="w-3.5 h-3.5" />
                        Competitor Ad Density
                      </div>
                      <Badge variant={genomeResult.competitor_ad_density_0_10 <= 6 ? 'success' : 'warning'} className="text-[10px]">
                        {genomeResult.competitor_ad_density_0_10.toFixed(1)}/10
                      </Badge>
                    </div>
                    <div className="text-2xl font-mono font-bold tabular-nums">
                      {genomeResult.competitor_ad_density_0_10.toFixed(1)}<span className="text-base text-[#A1A1A1] font-normal"> / 10</span>
                    </div>
                    <div className="text-[11px] text-[#A1A1A1]">
                      {genomeResult.competitor_ad_density_0_10 <= 3 ? '🟢 Blue ocean — low competition' : genomeResult.competitor_ad_density_0_10 <= 6 ? '🟡 Moderate — you can win' : '🔴 Saturated — CPAs will be high'}
                    </div>
                    {/* Mini bar */}
                    <div className="h-1 rounded-full bg-[#262626] overflow-hidden">
                      <div className="h-full rounded-full bg-[#EAB308]" style={{ width: `${(genomeResult.competitor_ad_density_0_10 / 10) * 100}%` }} />
                    </div>
                    <div className="text-[9px] text-[#333] pt-0.5">🤖 Competitor Intelligence Agent · Meta Ad Library + Google Ads</div>
                  </div>

                  {/* Language / Market Fit */}
                  <div className="p-4 rounded-lg border border-[#262626] bg-[#0D0D0D] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-[#A1A1A1]">
                        <BarChart2 className="w-3.5 h-3.5" />
                        Language–Market Fit
                      </div>
                      <Badge variant={genomeResult.language_market_fit_0_100 >= 60 ? 'success' : genomeResult.language_market_fit_0_100 >= 40 ? 'warning' : 'danger'} className="text-[10px]">
                        {Math.round(genomeResult.language_market_fit_0_100)}/100
                      </Badge>
                    </div>
                    <div className="text-2xl font-mono font-bold tabular-nums">
                      {Math.round(genomeResult.language_market_fit_0_100)}<span className="text-base text-[#A1A1A1] font-normal"> / 100</span>
                    </div>
                    <div className="text-[11px] text-[#A1A1A1]">
                      {genomeResult.language_market_fit_0_100 >= 60 ? '🟢 Buyers use the language you\'d use' : genomeResult.language_market_fit_0_100 >= 40 ? '🟡 Weak fit — test different messaging' : '🔴 Poor fit — rethink positioning'}
                    </div>
                    {/* Mini bar */}
                    <div className="h-1 rounded-full bg-[#262626] overflow-hidden">
                      <div className={`h-full rounded-full ${genomeResult.language_market_fit_0_100 >= 60 ? 'bg-[#22C55E]' : genomeResult.language_market_fit_0_100 >= 40 ? 'bg-[#EAB308]' : 'bg-[#EF4444]'}`} style={{ width: `${genomeResult.language_market_fit_0_100}%` }} />
                    </div>
                    <div className="text-[9px] text-[#333] pt-0.5">🤖 Language–Market Fit Agent · Keyword corpus + SERP intent</div>
                  </div>
                </div>

                {/* Pivot suggestion (NO-GO only) */}
                {genomeResult.verdict === 'NO-GO' && genomeResult.pivot_suggestion_15_words && (
                  <Card className="border-[#EAB308]/20 bg-[#EAB308]/5">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-2">
                        <RefreshCw className="w-4 h-4 text-[#EAB308] mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs text-[#EAB308] font-semibold mb-1 uppercase tracking-wider">AI Pivot Suggestion</div>
                          <div className="text-sm font-medium">{genomeResult.pivot_suggestion_15_words}</div>
                          <div className="text-xs text-[#A1A1A1] mt-1">Tweak your idea based on this, then re-analyze above.</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => { setGenomeResult(null); setGenomeIdea(''); setGenomeOverride(false); }}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Start Over
                    </Button>
                    {genomeResult.verdict === 'NO-GO' && !genomeOverride && (
                      <button className="text-xs text-[#A1A1A1] underline underline-offset-2 hover:text-[#FAFAFA] transition-colors" onClick={() => setGenomeOverride(true)}>
                        Override — proceed anyway
                      </button>
                    )}
                  </div>
                  {(genomeResult.verdict === 'GO' || genomeOverride) && (
                    <Button onClick={() => { setIdea(genomeIdea); setStep(1); }}>
                      Continue to Describe
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── STEP 1: DESCRIBE + CHANNEL SELECT ─────────────────────────── */}
        {step === 1 && (
          <motion.div key="step-describe" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Describe Your Test
                </CardTitle>
                <CardDescription>Choose channels and let AI generate all the ad copy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <label className="text-sm text-[#A1A1A1] mb-1.5 block">Startup Idea *</label>
                  <Textarea value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="e.g., AI-powered scheduling for dentists" rows={3} />
                </div>
                <div>
                  <label className="text-sm text-[#A1A1A1] mb-1.5 block">Target Audience</label>
                  <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g., Dental practice owners, US, 30-55" />
                </div>
                <div>
                  <label className="text-sm text-[#A1A1A1] mb-1.5 block">Offer</label>
                  <Input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="e.g., Free 14-day trial, no credit card" />
                </div>

                {/* Channel selector */}
                <div>
                  <label className="text-sm text-[#A1A1A1] mb-2 block">Channels to test on</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {CHANNEL_OPTIONS.map((ch) => {
                      const selected = channels.includes(ch.id);
                      const needsAccount = (ch.id === 'meta') && !activeAccountId;
                      return (
                        <button
                          key={ch.id}
                          onClick={() => toggleChannel(ch.id)}
                          className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-sm font-medium ${selected ? 'border-[#FAFAFA]/40 bg-[#FAFAFA]/5 text-[#FAFAFA]' : 'border-[#262626] bg-transparent text-[#A1A1A1] hover:border-[#333]'}`}
                        >
                          <span className="text-lg">{ch.icon}</span>
                          <span className="text-xs text-center leading-tight">{ch.label}</span>
                          {selected && <CheckCircle2 className="absolute top-1.5 right-1.5 w-3 h-3 text-[#22C55E]" />}
                          {needsAccount && <span className="absolute bottom-1 text-[9px] text-[#EAB308]">needs login</span>}
                        </button>
                      );
                    })}
                  </div>
                  {channels.includes('meta') && !activeAccountId && (
                    <p className="text-[11px] text-[#EAB308] mt-2">
                      ⚠ Meta selected but no ad account connected — copy will generate but deployment requires{' '}
                      <button className="underline" onClick={() => router.push('/accounts/connect')}>connecting Meta</button>.
                    </p>
                  )}
                  {channels.length === 0 && (
                    <p className="text-[11px] text-[#EF4444] mt-2">Select at least one channel.</p>
                  )}
                </div>

                <div className="flex justify-between pt-1">
                  <Button variant="outline" onClick={() => setStep(0)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={handleGenerate} disabled={!idea || loading || channels.length === 0}>
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {loading ? 'Generating...' : `Generate for ${channels.length} channel${channels.length > 1 ? 's' : ''}`}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── STEP 2: REVIEW ANGLES (multi-channel) ─────────────────────── */}
        {step === 2 && (goResult || legacyResult) && (
          <motion.div key="step-review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">

            {/* ICP / value prop (legacy only) */}
            {legacyResult && (
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="text-xs text-[#A1A1A1]">Ideal Customer Profile</div>
                  <div className="text-sm">{typeof legacyResult.icp === 'string' ? legacyResult.icp : JSON.stringify(legacyResult.icp)}</div>
                  <div className="text-xs text-[#A1A1A1] mt-2">Value Proposition</div>
                  <div className="text-sm">{typeof legacyResult.value_prop === 'string' ? legacyResult.value_prop : JSON.stringify(legacyResult.value_prop)}</div>
                </CardContent>
              </Card>
            )}

            {/* Channel tabs (multi-channel mode) */}
            {goResult && (
              <div className="flex gap-2 flex-wrap">
                {CHANNEL_OPTIONS.filter(c => channels.includes(c.id)).map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${activeChannel === ch.id ? 'border-[#FAFAFA]/40 bg-[#FAFAFA]/10 text-[#FAFAFA]' : 'border-[#262626] text-[#A1A1A1] hover:border-[#333]'}`}
                  >
                    {ch.icon} {ch.label}
                    {goResult[ch.id as keyof GoOutput] ? ' ✓' : ' —'}
                  </button>
                ))}
              </div>
            )}

            {/* Meta angles */}
            {(activeChannel === 'meta') && (
              <div>
                <div className="grid gap-4 md:grid-cols-3">
                  {editedMetaAngles.map((angle, i) => (
                    <Card key={i} className={`cursor-pointer transition-all ${selectedAngleIdx === i ? 'ring-1 ring-[#FAFAFA]' : 'opacity-60 hover:opacity-80'}`} onClick={() => setSelectedAngleIdx(i)}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          📘 Meta Angle {i + 1}
                          {selectedAngleIdx === i && <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <label className="text-[10px] text-[#A1A1A1] uppercase tracking-wider">Headline <span className="text-[#4A4A4A]">({angle.headline.length}/40)</span></label>
                          <Input value={angle.headline} onChange={(e) => updateMetaAngle(i, 'headline', e.target.value)} className="mt-1 text-sm" />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#A1A1A1] uppercase tracking-wider">Primary Text <span className="text-[#4A4A4A]">({angle.primary_text.length}/125)</span></label>
                          <Textarea value={angle.primary_text} onChange={(e) => updateMetaAngle(i, 'primary_text', e.target.value)} className="mt-1 text-sm" rows={3} />
                        </div>
                        <Badge variant="outline" className="text-xs">CTA: {angle.cta}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Policy scan */}
                <div className="flex items-center gap-3 mt-4">
                  <Button variant="outline" onClick={handlePolicyScan}>
                    <Shield className="w-4 h-4 mr-2" />
                    Run Policy Scan
                  </Button>
                  {policyResult && (
                    policyResult.blocked
                      ? <Badge variant="danger"><AlertTriangle className="w-3 h-3 mr-1" />Blocked</Badge>
                      : policyResult.risk_level === 'medium'
                      ? <Badge variant="warning">Review Needed</Badge>
                      : <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />Clear</Badge>
                  )}
                </div>
                {policyResult?.issues && policyResult.issues.length > 0 && (
                  <Card className="border-[#EAB308]/20 mt-3">
                    <CardContent className="pt-4">
                      <ul className="space-y-1">
                        {policyResult.issues.map((issue, idx) => (
                          <li key={idx} className="text-sm text-[#EAB308] flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{issue}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Google Ads */}
            {activeChannel === 'google' && goResult?.google && (
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2">🔍 Google Responsive Search Ad</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <div className="text-[10px] text-[#A1A1A1] uppercase tracking-wider mb-1">Headlines (30 chars each)</div>
                    {goResult.google.headlines.map((h, i) => (
                      <div key={i} className="font-medium text-[#4285F4]">{h}</div>
                    ))}
                  </div>
                  <div>
                    <div className="text-[10px] text-[#A1A1A1] uppercase tracking-wider mb-1">Descriptions (90 chars each)</div>
                    {goResult.google.descriptions.map((d, i) => (
                      <div key={i} className="text-[#A1A1A1]">{d}</div>
                    ))}
                  </div>
                  <div>
                    <div className="text-[10px] text-[#A1A1A1] uppercase tracking-wider mb-1">Display Path</div>
                    <div className="font-mono text-xs">yourdomain.com / {goResult.google.path1} / {goResult.google.path2}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#A1A1A1] uppercase tracking-wider mb-1">Keywords ({goResult.google.keywords?.length ?? 0})</div>
                    <div className="flex flex-wrap gap-1">
                      {(goResult.google.keywords ?? []).map((k, i) => <Badge key={i} variant="outline" className="text-[10px]">{k}</Badge>)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#A1A1A1] uppercase tracking-wider mb-1">Negative Keywords</div>
                    <div className="flex flex-wrap gap-1">
                      {(goResult.google.negative_keywords ?? []).map((k, i) => <Badge key={i} variant="outline" className="text-[10px] text-[#EF4444] border-[#EF4444]/30">−{k}</Badge>)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* TikTok — shown as Twitter/short-form copy since GoOutput doesn't have tiktok key; display note */}
            {activeChannel === 'tiktok' && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-[#A1A1A1] text-sm">
                    <AlertTriangle className="w-4 h-4 text-[#EAB308]" />
                    TikTok Ads API requires a separate Business account connection. Copy generated below is adapted from the Twitter short-form thread.
                  </div>
                  {goResult?.twitter && (
                    <div className="mt-3 space-y-2">
                      <div className="p-3 rounded-lg bg-[#111] border border-[#262626] text-sm font-medium">{goResult.twitter.tweet_1_hook}</div>
                      {goResult.twitter.thread_body.map((t, i) => (
                        <div key={i} className="p-3 rounded-lg bg-[#111] border border-[#262626] text-sm text-[#A1A1A1]">{t}</div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* LinkedIn */}
            {activeChannel === 'linkedin' && (
              <Card>
                <CardContent className="pt-4">
                  <div className="text-[#A1A1A1] text-sm">
                    LinkedIn Ads connection coming soon. Use the Meta or Google copy above as a starting point — adapt tone to be more B2B professional.
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={policyResult?.blocked}>
                Preview & Deploy
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: PREVIEW & DEPLOY ──────────────────────────────────── */}
        {step === 3 && (
          <motion.div key="step-deploy" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">

            {/* Account gate — only shown here, not blocking the whole flow */}
            {!activeAccountId && (
              <div className="flex items-center justify-between p-4 rounded-lg border border-[#EAB308]/30 bg-[#EAB308]/5">
                <div className="flex items-center gap-2 text-sm text-[#EAB308]">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  No Meta ad account connected. You can Demo Deploy (no spend) or{' '}
                  <button className="underline" onClick={() => router.push('/accounts/connect')}>connect Meta</button> for Live Deploy.
                </div>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Campaign Preview</CardTitle>
                <CardDescription>Review before launching</CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ['Idea', idea],
                      ['Channels', channels.map(c => CHANNEL_OPTIONS.find(o => o.id === c)?.label ?? c).join(', ')],
                      ['Audience', audience || 'Broad US 25-65'],
                      ['Budget', '$500 (max)'],
                      ['Duration', '48 hours'],
                      ['Headline', editedMetaAngles[selectedAngleIdx]?.headline],
                      ['Primary Text', editedMetaAngles[selectedAngleIdx]?.primary_text],
                    ].map(([label, val]) => (
                      <tr key={label} className="border-b border-[#262626]/50 h-10">
                        <td className="py-2 text-[#A1A1A1] w-36 align-top">{label}</td>
                        <td className="py-2">{val}</td>
                      </tr>
                    ))}
                    <tr className="h-10">
                      <td className="py-2 text-[#A1A1A1]">Healthgate™</td>
                      <td className="py-2">
                        {healthSnapshot ? (
                          <Badge variant="success">{healthSnapshot.score}/100</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[#A1A1A1]">Not connected</Badge>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Meta ad mockup */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Meta Ad Preview</CardTitle>
                <CardDescription>Click to customize brand image and name</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-sm mx-auto bg-[#111111] rounded-lg overflow-hidden border border-[#262626]">
                  <div className="p-3 flex items-center gap-2 border-b border-[#262626]">
                    <label className="relative cursor-pointer group shrink-0">
                      {brandImagePreview
                        ? <img src={brandImagePreview} alt="Brand" className="w-8 h-8 rounded-full object-cover" />
                        : <div className="w-8 h-8 rounded-full bg-[#262626] flex items-center justify-center group-hover:bg-[#333]"><Upload className="w-3.5 h-3.5 text-[#A1A1A1]" /></div>
                      }
                      <input type="file" accept="image/*" className="sr-only" onChange={handleBrandImageUpload} />
                    </label>
                    <div className="flex-1 min-w-0">
                      <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Your Brand Name" className="bg-transparent text-xs font-medium w-full outline-none border-b border-transparent hover:border-[#333] focus:border-[#FAFAFA] transition-colors placeholder:text-[#666]" />
                      <div className="text-[10px] text-[#A1A1A1]">Sponsored</div>
                    </div>
                  </div>
                  <div className="p-3 text-sm">{editedMetaAngles[selectedAngleIdx]?.primary_text}</div>
                  <label className="block aspect-square bg-[#262626] cursor-pointer relative group overflow-hidden">
                    {adImagePreview
                      ? <img src={adImagePreview} alt="Ad creative" className="w-full h-full object-cover" />
                      : <div className="flex flex-col items-center justify-center h-full gap-2 group-hover:bg-[#333] transition-colors"><Upload className="w-8 h-8 text-[#A1A1A1]" /><span className="text-xs text-[#A1A1A1]">Upload ad image</span></div>
                    }
                    {uploadingImage && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#FAFAFA]" /></div>}
                    <input type="file" accept="image/*" className="sr-only" onChange={handleAdImageUpload} />
                  </label>
                  <div className="p-3 border-t border-[#262626]">
                    <div className="text-xs text-[#A1A1A1]">{brandName ? brandName.toLowerCase().replace(/\s+/g, '') + '.com' : 'yourbrand.com'}</div>
                    <div className="text-sm font-semibold mt-0.5">{editedMetaAngles[selectedAngleIdx]?.headline}</div>
                  </div>
                </div>
                {imageHash && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#22C55E]">
                    <CheckCircle2 className="w-3.5 h-3.5" />Image uploaded to Meta
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Approval checkbox */}
            <div className="flex items-start gap-3 p-4 rounded-lg border border-[#262626] bg-[#111111]">
              <input type="checkbox" id="approve" checked={approved} onChange={(e) => setApproved(e.target.checked)} className="mt-0.5 rounded border-[#262626]" />
              <label htmlFor="approve" className="text-sm leading-relaxed">
                I approve this campaign. I understand that <strong>Live Deploy</strong> triggers up to $500 of real Meta ad spend.
              </label>
            </div>

            {deployError && (
              <div className="p-4 rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/5">
                <div className="flex items-center gap-2 text-sm text-[#EF4444] font-medium mb-1"><AlertTriangle className="w-4 h-4 shrink-0" />Deploy Failed</div>
                <p className="text-xs text-[#A1A1A1] font-mono break-all">{deployError}</p>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button onClick={handleDemoDeploy} disabled={demoDeploying || deploying} variant="outline" title="Simulated campaign — zero spend">
                  {demoDeploying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {demoDeploying ? 'Creating Demo...' : 'Demo Deploy'}
                </Button>
                <Button onClick={handleDeploy} disabled={!approved || !activeAccountId || deploying || demoDeploying} variant="success" title={!activeAccountId ? 'Connect Meta account first' : ''}>
                  {deploying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                  {deploying ? 'Deploying...' : 'Deploy Live'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
