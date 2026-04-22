'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, ArrowRight, ArrowLeft, Loader2, CheckCircle2, FlaskConical,
  Users, Target, Sparkles, RefreshCw, Shield, AlertTriangle,
  ExternalLink, BarChart2, Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { createTest, createDemoTest } from '../../new/actions';
import type { GoOutput, Platform, GenomeOutput } from '@/lib/prompts';

// ── Types ──────────────────────────────────────────────────────────────────

interface LegacyAngle { headline: string; primary_text: string; cta: string; }
interface LegacyAIResult { icp: string; value_prop: string; angles: LegacyAngle[]; }

const CHANNEL_OPTIONS: { id: Platform; label: string; color: string; icon: string }[] = [
  { id: 'meta',     label: 'Meta (FB/IG)',  color: '#1877F2', icon: '📘' },
  { id: 'google',   label: 'Google Ads',    color: '#4285F4', icon: '🔍' },
  { id: 'tiktok',  label: 'TikTok Ads',    color: '#FF0050', icon: '🎵' },
  { id: 'linkedin', label: 'LinkedIn',      color: '#0A66C2', icon: '💼' },
];

const STEPS = ['Describe', 'Generate Copy', 'Preview & Deploy'];

// ── Component ──────────────────────────────────────────────────────────────

export default function TestSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { healthSnapshot, activeAccountId, orgId, connectedPlatforms } = useAppStore();

  const [step, setStep] = useState(0);

  // Genome context (loaded from the test record)
  const [genome, setGenome] = useState<GenomeOutput | null>(null);
  const [ideaFromRecord, setIdeaFromRecord] = useState('');
  const [loadingTest, setLoadingTest] = useState(true);

  // Step 0 — Describe
  const [audience, setAudience] = useState('');
  const [offer, setOffer] = useState('');
  const [channels, setChannels] = useState<Platform[]>(['meta']);
  const [generating, setGenerating] = useState(false);

  // Step 1 — Review
  const [goResult, setGoResult] = useState<GoOutput | null>(null);
  const [legacyResult, setLegacyResult] = useState<LegacyAIResult | null>(null);
  const [editedAngles, setEditedAngles] = useState<LegacyAngle[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeChannel, setActiveChannel] = useState<Platform>('meta');

  // Step 2 — Deploy
  const [brandName, setBrandName] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [demoDeploying, setDemoDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);

  // Load test record to get genome + idea
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/tests/${id}/metrics`);
        if (res.ok) {
          const data = await res.json();
          if (data.test) {
            setIdeaFromRecord(data.test.idea || data.test.name || '');
            if (data.test.genome_result) setGenome(data.test.genome_result);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingTest(false);
      }
    }
    load();
  }, [id]);

  const toggleChannel = (ch: Platform) =>
    setChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);

  // ── Step 0 → 1: Generate copy ──────────────────────────────────────────

  const handleGenerate = async () => {
    if (!ideaFromRecord.trim()) return;
    setGenerating(true);
    try {
      if (channels.length === 1 && channels[0] === 'meta') {
        const res = await fetch('/api/angle/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea: ideaFromRecord, audience, offer }),
        });
        const data: LegacyAIResult = await res.json();
        setLegacyResult(data);
        setEditedAngles(data.angles || []);
      } else {
        const res = await fetch('/api/angle/go', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea: ideaFromRecord, audience, offer, channels }),
        });
        const data: GoOutput = await res.json();
        setGoResult(data);
        setActiveChannel(channels[0]);
      }
      setStep(1);
    } catch (err) {
      console.error('[generate]', err);
    } finally {
      setGenerating(false);
    }
  };

  // ── Step 2: Deploy ────────────────────────────────────────────────────

  const getSelectedAngle = () => {
    if (legacyResult) return editedAngles[selectedIdx] || legacyResult.angles[0];
    if (goResult?.meta) return { headline: goResult.meta.headline, primary_text: goResult.meta.primary_text, cta: goResult.meta.cta };
    return null;
  };

  const handleDemoDeploy = async () => {
    setDemoDeploying(true);
    await new Promise((r) => setTimeout(r, 1400));
    const angle = getSelectedAngle();
    try {
      await createDemoTest({ idea: ideaFromRecord, audience, offer, angle: angle || { headline: 'Demo', primary_text: 'Demo', cta: 'LEARN_MORE' }, brandName });
      router.push('/tests');
    } catch (err) {
      console.error(err);
    } finally {
      setDemoDeploying(false);
    }
  };

  const handleLiveDeploy = async () => {
    const angle = getSelectedAngle();
    if (!angle || !activeAccountId || !orgId) return;
    setDeploying(true);
    setDeployError(null);
    try {
      const result = await createTest({
        idea: ideaFromRecord,
        audience,
        offer,
        angle,
        orgId,
        adAccountId: activeAccountId,
        brandName,
      });
      if (result.success && result.testId) {
        router.push(`/tests/${result.testId}`);
      } else {
        setDeployError(result.error || 'Deploy failed');
        setDeploying(false);
      }
    } catch (err) {
      setDeployError('Unexpected error');
      setDeploying(false);
    }
  };

  if (loadingTest) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#A1A1A1]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Header with genome context */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-[#4A4A4A]">
          <button onClick={() => router.push('/tests/new')} className="hover:text-[#A1A1A1] transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> New Test
          </button>
          <span>/</span>
          <span className="text-[#A1A1A1] font-mono text-xs truncate max-w-[200px]">{id}</span>
        </div>

        {/* Genome context banner */}
        {genome && (
          <div className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
            genome.verdict === 'GO' ? 'border-[#2A2A2A] bg-[#141414]' : 'border-[#2A2A2A] bg-[#141414]'
          }`}>
            <FlaskConical className={`w-4 h-4 mt-0.5 shrink-0 ${genome.verdict === 'GO' ? 'text-[#FAFAFA]' : 'text-[#888]'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-semibold ${genome.verdict === 'GO' ? 'text-[#FAFAFA]' : 'text-[#888]'}`}>
                  Genome: {genome.verdict}
                </span>
                <span className="text-[11px] text-[#4A4A4A]">{genome.reasoning_1_sentence}</span>
              </div>
              <div className="flex items-center gap-4 mt-1.5">
                <span className="text-[10px] text-[#4A4A4A]">
                  Search: <strong className="text-[#666]">{genome.search_volume_monthly >= 1000 ? `${(genome.search_volume_monthly / 1000).toFixed(1)}K` : genome.search_volume_monthly}/mo</strong>
                </span>
                <span className="text-[10px] text-[#4A4A4A]">
                  Ad density: <strong className="text-[#666]">{genome.competitor_ad_density_0_10.toFixed(1)}/10</strong>
                </span>
                <span className="text-[10px] text-[#4A4A4A]">
                  Language fit: <strong className="text-[#666]">{Math.round(genome.language_market_fit_0_100)}/100</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Step bar */}
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                i === step ? 'border-[#FAFAFA] text-[#FAFAFA] bg-[#FAFAFA]/5' :
                i < step ? 'border-[#2A2A2A] text-[#FAFAFA]' :
                'border-[#262626] text-[#4A4A4A]'
              }`}>
                {i < step && <CheckCircle2 className="w-3 h-3" />}
                {i === step && <span className="w-1.5 h-1.5 rounded-full bg-[#FAFAFA] inline-block" />}
                {label}
              </div>
              {i < STEPS.length - 1 && <div className="w-4 h-px bg-[#262626]" />}
            </div>
          ))}
        </div>
      </div>

      {/* ── STEP 0: Describe ── */}
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="describe" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  Describe your campaign
                </CardTitle>
                <CardDescription>
                  Fill in audience and offer — the AI will write production-ready copy for your selected channels.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-[#A1A1A1] mb-1.5 block">Idea</label>
                  <div className="px-3 py-2 rounded-md border border-[#262626] bg-[#0D0D0D] text-sm text-[#666]">
                    {ideaFromRecord || 'Loading…'}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#A1A1A1] mb-1.5 block">Target Audience</label>
                  <Input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="e.g., Dental office managers aged 30-50"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#A1A1A1] mb-1.5 block">Offer / Hook</label>
                  <Textarea
                    value={offer}
                    onChange={(e) => setOffer(e.target.value)}
                    placeholder="e.g., 14-day free trial, no credit card required"
                    rows={2}
                  />
                </div>

                {/* Channel selector */}
                <div>
                  <label className="text-sm text-[#A1A1A1] mb-2 block">Channels</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CHANNEL_OPTIONS.map((ch) => {
                      const conn = connectedPlatforms.find((c) => c.platform === ch.id);
                      const selected = channels.includes(ch.id);
                      return (
                        <button
                          key={ch.id}
                          onClick={() => toggleChannel(ch.id)}
                          className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all ${
                            selected ? 'border-[#FAFAFA]/20 bg-[#FAFAFA]/5' : 'border-[#1E1E1E] hover:border-[#262626]'
                          }`}
                        >
                          <span className="text-lg">{ch.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium">{ch.label}</div>
                            {conn ? (
                              <div className="text-[10px] text-[#FAFAFA] flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" />Connected</div>
                            ) : (
                              <div className="text-[10px] text-[#4A4A4A]">Demo mode</div>
                            )}
                          </div>
                          {selected && <CheckCircle2 className="w-3.5 h-3.5 text-[#FAFAFA] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleGenerate} disabled={channels.length === 0 || generating}>
                    {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating copy…</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Ad Copy</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── STEP 1: Review copy ── */}
        {step === 1 && (
          <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            {/* Channel tabs (multi-channel) */}
            {goResult && (
              <div className="flex gap-1">
                {channels.map((ch) => {
                  const opt = CHANNEL_OPTIONS.find((o) => o.id === ch)!;
                  return (
                    <button
                      key={ch}
                      onClick={() => setActiveChannel(ch)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
                        activeChannel === ch ? 'bg-[#FAFAFA]/8 border-[#FAFAFA]/20 text-[#FAFAFA]' : 'border-transparent text-[#4A4A4A] hover:text-[#A1A1A1]'
                      }`}
                    >
                      {opt?.icon} {opt?.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Meta copy */}
            {goResult && activeChannel === 'meta' && goResult.meta && (
              <Card>
                <CardHeader><CardTitle className="text-sm">📘 Meta Ad Copy</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div><div className="text-[10px] text-[#4A4A4A] mb-1">HEADLINE</div><div className="font-semibold">{goResult.meta.headline}</div></div>
                  <div><div className="text-[10px] text-[#4A4A4A] mb-1">PRIMARY TEXT</div><div className="text-[#A1A1A1]">{goResult.meta.primary_text}</div></div>
                  <Badge variant="outline">{goResult.meta.cta}</Badge>
                </CardContent>
              </Card>
            )}

            {/* Google copy */}
            {goResult && activeChannel === 'google' && goResult.google && (
              <Card>
                <CardHeader><CardTitle className="text-sm">🔍 Google Responsive Search Ad</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <div className="text-[10px] text-[#4A4A4A] mb-1">HEADLINES</div>
                    <div className="space-y-1">{goResult.google.headlines.map((h, i) => <div key={i} className="font-medium">{h}</div>)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#4A4A4A] mb-1">DESCRIPTIONS</div>
                    {goResult.google.descriptions.map((d, i) => <div key={i} className="text-[#A1A1A1]">{d}</div>)}
                  </div>
                  <div>
                    <div className="text-[10px] text-[#4A4A4A] mb-1">KEYWORDS</div>
                    <div className="flex flex-wrap gap-1">{goResult.google.keywords?.map((k) => <span key={k} className="text-[10px] px-1.5 py-0.5 bg-[#1A1A1A] border border-[#262626] rounded text-[#A1A1A1]">{k}</span>)}</div>
                  </div>
                  <div className="text-[10px] text-[#4A4A4A]">Display path: {goResult.google.path1}/{goResult.google.path2}</div>
                </CardContent>
              </Card>
            )}

            {/* TikTok copy */}
            {goResult && activeChannel === 'tiktok' && goResult.twitter && (
              <Card>
                <CardHeader><CardTitle className="text-sm">🎵 TikTok Ad Script</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div><div className="text-[10px] text-[#4A4A4A] mb-1">HOOK (first 3s)</div><div className="font-semibold">{goResult.twitter.tweet_1_hook}</div></div>
                  <div>
                    <div className="text-[10px] text-[#4A4A4A] mb-1">SCRIPT BEATS</div>
                    <div className="space-y-2">{goResult.twitter.thread_body?.map((t, i) => <div key={i} className="text-[#A1A1A1] border-l-2 border-[#262626] pl-2">{t}</div>)}</div>
                  </div>
                  <div><div className="text-[10px] text-[#4A4A4A] mb-1">CTA</div><div className="text-[#A1A1A1]">{goResult.twitter.cta_link_text}</div></div>
                </CardContent>
              </Card>
            )}

            {/* LinkedIn copy */}
            {goResult && activeChannel === 'linkedin' && (
              <Card>
                <CardHeader><CardTitle className="text-sm">💼 LinkedIn Sponsored Content</CardTitle></CardHeader>
                <CardContent className="text-sm text-[#A1A1A1]">
                  {goResult.meta ? (
                    <div className="space-y-2">
                      <div><span className="text-[10px] text-[#4A4A4A]">HEADLINE</span><div className="font-medium text-[#FAFAFA]">{goResult.meta.headline}</div></div>
                      <div><span className="text-[10px] text-[#4A4A4A]">COPY</span><div>{goResult.meta.primary_text}</div></div>
                    </div>
                  ) : 'No LinkedIn copy generated.'}
                </CardContent>
              </Card>
            )}

            {/* Legacy meta-only angles */}
            {legacyResult && (
              <div className="space-y-3">
                <div className="text-xs text-[#4A4A4A] px-1">ICP: {legacyResult.icp} · Value prop: {legacyResult.value_prop}</div>
                {editedAngles.map((angle, i) => (
                  <Card key={i} className={`cursor-pointer transition-all ${selectedIdx === i ? 'border-[#FAFAFA]/30' : 'border-[#1E1E1E]'}`} onClick={() => setSelectedIdx(i)}>
                    <CardContent className="pt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Angle {i + 1}</Badge>
                        {selectedIdx === i && <CheckCircle2 className="w-4 h-4 text-[#FAFAFA]" />}
                      </div>
                      <Input value={angle.headline} onChange={(e) => setEditedAngles((prev) => prev.map((a, j) => j === i ? { ...a, headline: e.target.value } : a))} className="font-medium" />
                      <Textarea value={angle.primary_text} rows={2} onChange={(e) => setEditedAngles((prev) => prev.map((a, j) => j === i ? { ...a, primary_text: e.target.value } : a))} />
                      <Badge variant="outline">{angle.cta}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep(0)}><ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Back</Button>
              <Button onClick={() => setStep(2)}>Continue to Deploy <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: Deploy ── */}
        {step === 2 && (
          <motion.div key="deploy" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4" />Launch Campaign</CardTitle>
                <CardDescription>Review your setup and deploy. Demo mode works without a connected ad account.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-[#A1A1A1] mb-1.5 block">Brand Name (optional)</label>
                  <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g., Dentflow" />
                </div>

                {/* Summary */}
                <div className="rounded-lg border border-[#262626] divide-y divide-[#1E1E1E] text-sm">
                  <div className="flex justify-between px-4 py-2.5"><span className="text-[#4A4A4A]">Idea</span><span className="text-right max-w-[60%] truncate">{ideaFromRecord}</span></div>
                  <div className="flex justify-between px-4 py-2.5"><span className="text-[#4A4A4A]">Audience</span><span className="text-right max-w-[60%] truncate">{audience || '—'}</span></div>
                  <div className="flex justify-between px-4 py-2.5"><span className="text-[#4A4A4A]">Channels</span><span>{channels.map((c) => CHANNEL_OPTIONS.find((o) => o.id === c)?.icon).join(' ')}</span></div>
                  <div className="flex justify-between px-4 py-2.5"><span className="text-[#4A4A4A]">Meta account</span><span className={activeAccountId ? 'text-[#FAFAFA]' : 'text-[#4A4A4A]'}>{activeAccountId ? 'Connected' : 'Not connected'}</span></div>
                </div>

                {deployError && (
                  <div className="flex items-start gap-2 p-3 rounded-md border border-[#2A2A2A] bg-[#141414] text-sm text-[#777]">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{deployError}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setStep(1)}><ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Back</Button>
                  <div className="flex-1" />
                  <Button variant="outline" onClick={handleDemoDeploy} disabled={demoDeploying}>
                    {demoDeploying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Simulating…</> : <><Zap className="w-4 h-4 mr-2" />Demo Deploy</>}
                  </Button>
                  <Button onClick={handleLiveDeploy} disabled={!activeAccountId || deploying}>
                    {deploying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Launching…</> : <><ExternalLink className="w-4 h-4 mr-2" />Live Deploy</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
