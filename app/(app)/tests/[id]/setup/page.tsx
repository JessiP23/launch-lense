'use client';

import { useState, use, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, ArrowRight, ArrowLeft, Loader2, CheckCircle2, FlaskConical,
  Users, Target, Sparkles, RefreshCw, Shield, AlertTriangle,
  ExternalLink, BarChart2, Brain, Wand2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { createTest, createDemoTest } from '../../new/actions';
import type { GoOutput, Platform, GenomeOutput } from '@/lib/prompts';
import {
  MetaAdPreview, GoogleAdPreview, TikTokAdPreview, LinkedInAdPreview,
} from '@/components/ad-preview';

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

// ── Shared sub-components ──────────────────────────────────────────────────

interface EditFieldProps {
  label: string;
  hint?: string;
  warn?: boolean;
  value: string;
  multiline?: boolean;
  onChange: (v: string) => void;
  onImprove: () => void;
  improving: boolean;
}

function EditField({ label, hint, warn, value, multiline, onChange, onImprove, improving }: EditFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-[#555]">{label}</span>
        {hint && <span className={`text-[9px] ${warn ? 'text-[#888]' : 'text-[#333]'}`}>{hint}</span>}
      </div>
      <div className="flex items-start gap-1.5">
        {multiline ? (
          <Textarea
            value={value}
            rows={3}
            onChange={(e) => onChange(e.target.value)}
            className={`text-xs flex-1 ${warn ? 'border-[#555]' : ''}`}
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`text-xs h-8 flex-1 ${warn ? 'border-[#555]' : ''}`}
          />
        )}
        <ImproveBtn onClick={onImprove} loading={improving} />
      </div>
    </div>
  );
}

function ImproveBtn({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title="AI Improve"
      className="shrink-0 w-7 h-7 mt-0.5 flex items-center justify-center rounded border border-[#1E1E1E] hover:border-[#2A2A2A] bg-[#0D0D0D] hover:bg-[#141414] transition-all disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin text-[#555]" /> : <Wand2 className="w-3 h-3 text-[#555]" />}
    </button>
  );
}

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

  // ── Editable copy state per platform ──────────────────────────────────
  const [editedMeta, setEditedMeta] = useState<{ headline: string; primary_text: string; cta: string } | null>(null);
  const [editedGoogle, setEditedGoogle] = useState<{ headlines: string[]; descriptions: string[]; path1: string; path2: string; keywords?: string[] } | null>(null);
  const [editedTikTok, setEditedTikTok] = useState<{ hook: string; script: string[]; cta: string } | null>(null);
  const [editedLinkedIn, setEditedLinkedIn] = useState<{ headline: string; intro_text: string; cta: string } | null>(null);

  // Ad images per platform
  const [adImages, setAdImages] = useState<Partial<Record<Platform, string>>>({});

  // AI improve state — tracks which field is being improved
  const [improving, setImproving] = useState<string | null>(null);

  // Initialize editable states when AI result arrives
  useEffect(() => {
    if (goResult) {
      if (goResult.meta) setEditedMeta({ headline: goResult.meta.headline, primary_text: goResult.meta.primary_text, cta: goResult.meta.cta });
      if (goResult.google) setEditedGoogle({ headlines: [...goResult.google.headlines], descriptions: [...goResult.google.descriptions], path1: goResult.google.path1 ?? 'app', path2: goResult.google.path2 ?? 'trial', keywords: goResult.google.keywords });
      if (goResult.twitter) {
        setEditedTikTok({ hook: goResult.twitter.tweet_1_hook, script: [...(goResult.twitter.thread_body ?? [])], cta: goResult.twitter.cta_link_text ?? 'Learn More' });
      } else if (channels.includes('tiktok')) {
        // Fallback if LLM didn't return tiktok data
        setEditedTikTok({ hook: `Stop scrolling — ${ideaFromRecord.slice(0, 40)}`, script: ['Here\'s the problem...', 'We built a solution.', 'Try it free today.'], cta: 'Learn More' });
      }
      // LinkedIn: synthesize from meta if no dedicated linkedin field
      if (goResult.meta) setEditedLinkedIn({ headline: goResult.meta.headline, intro_text: goResult.meta.primary_text, cta: goResult.meta.cta });
    }
    if (legacyResult?.angles?.[0]) {
      const a = legacyResult.angles[selectedIdx] ?? legacyResult.angles[0];
      setEditedMeta({ headline: a.headline, primary_text: a.primary_text, cta: a.cta });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goResult, legacyResult]);

  // AI improve helper
  const handleImprove = async (platform: Platform, field: string, currentValue: string) => {
    const key = `${platform}:${field}`;
    setImproving(key);
    try {
      const res = await fetch('/api/angle/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, field, value: currentValue, idea: ideaFromRecord, audience, offer }),
      });
      const data = await res.json() as { improved?: string };
      if (!data.improved) return;
      const v = data.improved;
      if (platform === 'meta') {
        setEditedMeta((prev) => prev ? { ...prev, [field]: v } : null);
        if (legacyResult) setEditedAngles((prev) => prev.map((a, i) => i === selectedIdx ? { ...a, [field]: v } : a));
      } else if (platform === 'google') {
        if (field === 'google_headline') {
          setEditedGoogle((prev) => prev ? { ...prev, headlines: prev.headlines.map((h, i) => i === 0 ? v : h) } : null);
        } else if (field === 'google_description') {
          setEditedGoogle((prev) => prev ? { ...prev, descriptions: prev.descriptions.map((d, i) => i === 0 ? v : d) } : null);
        }
      } else if (platform === 'tiktok') {
        setEditedTikTok((prev) => prev ? { ...prev, [field]: v } : null);
      } else if (platform === 'linkedin') {
        setEditedLinkedIn((prev) => prev ? { ...prev, [field]: v } : null);
      }
    } catch (err) {
      console.error('[improve]', err);
    } finally {
      setImproving(null);
    }
  };

  // Load test record to get genome + idea
  useEffect(() => {
    async function load() {
      // 1. Try sessionStorage first — populated immediately by tests/new page
      try {
        const cached = sessionStorage.getItem(`test:${id}`);
        if (cached) {
          const { idea, genome: g } = JSON.parse(cached) as { idea: string; genome: GenomeOutput };
          setIdeaFromRecord(idea);
          if (g) setGenome(g);
          setLoadingTest(false);
          return; // no need to hit the API
        }
      } catch (_) { /* ignore parse errors */ }

      // 2. Fetch from /api/tests/[id]
      try {
        const res = await fetch(`/api/tests/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.test) {
            setIdeaFromRecord(data.test.idea || data.test.name || '');
            if (data.test.genome_result) setGenome(data.test.genome_result as GenomeOutput);
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

  // ── Step 2: Multi-channel deploy ─────────────────────────────────────

  type DeployStatus = 'pending' | 'running' | 'done' | 'error' | 'demo';
  const [channelStatuses, setChannelStatuses] = useState<Partial<Record<Platform, DeployStatus>>>({});
  const [channelErrors, setChannelErrors] = useState<Partial<Record<Platform, string>>>({});

  const setChannelStatus = (ch: Platform, s: DeployStatus) =>
    setChannelStatuses((p) => ({ ...p, [ch]: s }));
  const setChannelError = (ch: Platform, msg: string) =>
    setChannelErrors((p) => ({ ...p, [ch]: msg }));

  const getMetaAngle = () => {
    if (editedMeta) return editedMeta;
    if (legacyResult) return editedAngles[selectedIdx] || legacyResult.angles[0];
    return null;
  };

  /** Deploy a single channel. Returns true on success. */
  const deployChannel = async (ch: Platform, isDemo: boolean): Promise<boolean> => {
    setChannelStatus(ch, 'running');
    try {
      if (ch === 'meta') {
        const angle = getMetaAngle();
        if (!angle) { setChannelStatus(ch, 'error'); setChannelError(ch, 'No Meta copy generated'); return false; }
        if (isDemo) {
          await new Promise((r) => setTimeout(r, 900 + Math.random() * 400));
          const demoResult = await createDemoTest({
            idea: ideaFromRecord,
            audience,
            offer,
            angle,
            brandName,
            orgId: orgId ?? undefined,
            adAccountId: activeAccountId ?? undefined,
          });
          if (!demoResult.success) {
            setChannelStatus(ch, 'error');
            setChannelError(ch, demoResult.error || 'Demo deploy failed');
            return false;
          }
        } else {
          if (!activeAccountId || !orgId) { setChannelStatus(ch, 'error'); setChannelError(ch, 'No Meta account connected'); return false; }
          const result = await createTest({ idea: ideaFromRecord, audience, offer, angle, orgId, adAccountId: activeAccountId, brandName });
          if (!result.success) { setChannelStatus(ch, 'error'); setChannelError(ch, result.error || 'Meta deploy failed'); return false; }
        }
      } else {
        // Google / TikTok / LinkedIn — simulated (API integrations in Phase 2–4)
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
        const copy = ch === 'google' ? editedGoogle : ch === 'tiktok' ? editedTikTok : editedLinkedIn;
        if (!copy) { setChannelStatus(ch, 'error'); setChannelError(ch, `No ${ch} copy generated`); return false; }
      }
      setChannelStatus(ch, isDemo ? 'demo' : 'done');
      return true;
    } catch (err) {
      setChannelStatus(ch, 'error');
      setChannelError(ch, err instanceof Error ? err.message : 'Unexpected error');
      return false;
    }
  };

  const handleDeploy = async (isDemo: boolean) => {
    if (isDemo) setDemoDeploying(true); else setDeploying(true);
    setDeployError(null);
    // Reset statuses
    setChannelStatuses({});
    setChannelErrors({});

    // Deploy all selected channels in parallel
    const results = await Promise.allSettled(channels.map((ch) => deployChannel(ch, isDemo)));
    const allOk = results.every((r) => r.status === 'fulfilled' && r.value === true);

    if (isDemo) setDemoDeploying(false); else setDeploying(false);

    if (allOk) {
      await new Promise((r) => setTimeout(r, 600)); // brief pause to show success state
      router.push('/tests');
    } else {
      setDeployError('One or more channels failed — see details below.');
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

        {/* ── STEP 1: Review & Edit copy ── */}
        {step === 1 && (
          <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">

            {/* Channel tabs */}
            <div className="flex gap-1 flex-wrap">
              {channels.map((ch) => {
                const opt = CHANNEL_OPTIONS.find((o) => o.id === ch)!;
                return (
                  <button
                    key={ch}
                    onClick={() => setActiveChannel(ch)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
                      activeChannel === ch
                        ? 'bg-[#FAFAFA]/8 border-[#FAFAFA]/20 text-[#FAFAFA]'
                        : 'border-transparent text-[#4A4A4A] hover:text-[#A1A1A1]'
                    }`}
                  >
                    {opt?.icon} {opt?.label}
                  </button>
                );
              })}
            </div>

            {/* ── META ── */}
            {activeChannel === 'meta' && editedMeta && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  {/* Preview */}
                  <div>
                    <div className="text-[10px] text-[#3A3A3A] uppercase tracking-wider mb-2 px-1">Live Preview</div>
                    <MetaAdPreview
                      headline={editedMeta.headline}
                      primary_text={editedMeta.primary_text}
                      cta={editedMeta.cta}
                      brandName={brandName || 'Your Brand'}
                      image={adImages.meta}
                      onImageUpload={(url) => setAdImages((p) => ({ ...p, meta: url }))}
                    />
                  </div>
                  {/* Edit fields */}
                  <div className="space-y-3">
                    <div className="text-[10px] text-[#3A3A3A] uppercase tracking-wider mb-2 px-1">Edit Copy</div>

                    <EditField
                      label="Headline"
                      hint={`${editedMeta.headline.length}/40 chars`}
                      warn={editedMeta.headline.length > 40}
                      value={editedMeta.headline}
                      onChange={(v) => setEditedMeta((p) => p ? { ...p, headline: v } : null)}
                      onImprove={() => handleImprove('meta', 'headline', editedMeta.headline)}
                      improving={improving === 'meta:headline'}
                    />
                    <EditField
                      label="Primary Text"
                      hint={`${editedMeta.primary_text.length}/125 chars`}
                      warn={editedMeta.primary_text.length > 125}
                      value={editedMeta.primary_text}
                      multiline
                      onChange={(v) => setEditedMeta((p) => p ? { ...p, primary_text: v } : null)}
                      onImprove={() => handleImprove('meta', 'primary_text', editedMeta.primary_text)}
                      improving={improving === 'meta:primary_text'}
                    />
                    <div>
                      <div className="text-[10px] text-[#555] mb-1.5">CTA Button</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'GET_QUOTE', 'BOOK_NOW'] as const).map((c) => (
                          <button
                            key={c}
                            onClick={() => setEditedMeta((p) => p ? { ...p, cta: c } : null)}
                            className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-all ${
                              editedMeta.cta === c ? 'border-[#FAFAFA]/30 bg-[#FAFAFA]/8 text-[#FAFAFA]' : 'border-[#1E1E1E] text-[#555] hover:border-[#2A2A2A]'
                            }`}
                          >
                            {c.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── GOOGLE ── */}
            {activeChannel === 'google' && editedGoogle && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  <div>
                    <div className="text-[10px] text-[#3A3A3A] uppercase tracking-wider mb-2 px-1">SERP Preview</div>
                    <GoogleAdPreview
                      headlines={editedGoogle.headlines}
                      descriptions={editedGoogle.descriptions}
                      path1={editedGoogle.path1}
                      path2={editedGoogle.path2}
                      brandName={brandName}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="text-[10px] text-[#3A3A3A] uppercase tracking-wider mb-2 px-1">Edit Copy</div>
                    <div>
                      <div className="text-[10px] text-[#555] mb-1.5">Headlines <span className="text-[#333]">(max 30 chars each)</span></div>
                      <div className="space-y-1.5">
                        {editedGoogle.headlines.map((h, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <Input
                              value={h}
                              onChange={(e) => setEditedGoogle((p) => p ? { ...p, headlines: p.headlines.map((x, j) => j === i ? e.target.value : x) } : null)}
                              className={`text-xs h-8 ${h.length > 30 ? 'border-[#555]' : ''}`}
                            />
                            <span className={`text-[9px] w-6 text-right shrink-0 ${h.length > 30 ? 'text-[#888]' : 'text-[#333]'}`}>{h.length}</span>
                            {i === 0 && (
                              <ImproveBtn
                                onClick={() => handleImprove('google', 'google_headline', h)}
                                loading={improving === 'google:google_headline'}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#555] mb-1.5">Descriptions <span className="text-[#333]">(max 90 chars each)</span></div>
                      <div className="space-y-1.5">
                        {editedGoogle.descriptions.map((d, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <Textarea
                              value={d}
                              rows={2}
                              onChange={(e) => setEditedGoogle((p) => p ? { ...p, descriptions: p.descriptions.map((x, j) => j === i ? e.target.value : x) } : null)}
                              className={`text-xs ${d.length > 90 ? 'border-[#555]' : ''}`}
                            />
                            <div className="flex flex-col gap-1">
                              <span className={`text-[9px] w-6 text-right shrink-0 ${d.length > 90 ? 'text-[#888]' : 'text-[#333]'}`}>{d.length}</span>
                              {i === 0 && (
                                <ImproveBtn
                                  onClick={() => handleImprove('google', 'google_description', d)}
                                  loading={improving === 'google:google_description'}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {editedGoogle.keywords && editedGoogle.keywords.length > 0 && (
                      <div>
                        <div className="text-[10px] text-[#555] mb-1.5">Keywords</div>
                        <div className="flex flex-wrap gap-1">
                          {editedGoogle.keywords.map((k) => (
                            <span key={k} className="text-[10px] px-1.5 py-0.5 bg-[#1A1A1A] border border-[#262626] rounded text-[#666]">{k}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── TIKTOK ── */}
            {activeChannel === 'tiktok' && editedTikTok && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  <div>
                    <div className="text-[10px] text-[#3A3A3A] uppercase tracking-wider mb-2 px-1">In-Feed Preview</div>
                    <TikTokAdPreview
                      hook={editedTikTok.hook}
                      script={editedTikTok.script}
                      ctaText={editedTikTok.cta}
                      brandName={brandName || 'Your Brand'}
                      image={adImages.tiktok}
                      onImageUpload={(url) => setAdImages((p) => ({ ...p, tiktok: url }))}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="text-[10px] text-[#3A3A3A] uppercase tracking-wider mb-2 px-1">Edit Script</div>
                    <EditField
                      label="Hook (first 3 seconds)"
                      hint="Bold claim or question — max 15 words"
                      value={editedTikTok.hook}
                      onChange={(v) => setEditedTikTok((p) => p ? { ...p, hook: v } : null)}
                      onImprove={() => handleImprove('tiktok', 'hook', editedTikTok.hook)}
                      improving={improving === 'tiktok:hook'}
                    />
                    <div>
                      <div className="text-[10px] text-[#555] mb-1.5">Script Beats</div>
                      <div className="space-y-1.5">
                        {editedTikTok.script.map((beat, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="text-[10px] text-[#333] mt-2 w-4 shrink-0">{i + 1}.</span>
                            <Textarea
                              value={beat}
                              rows={2}
                              onChange={(e) => setEditedTikTok((p) => p ? { ...p, script: p.script.map((x, j) => j === i ? e.target.value : x) } : null)}
                              className="text-xs flex-1"
                            />
                            <ImproveBtn
                              onClick={() => handleImprove('tiktok', 'script_beat', beat)}
                              loading={improving === 'tiktok:script_beat'}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <EditField
                      label="CTA Overlay"
                      hint="Action verb first — max 8 words"
                      value={editedTikTok.cta}
                      onChange={(v) => setEditedTikTok((p) => p ? { ...p, cta: v } : null)}
                      onImprove={() => handleImprove('tiktok', 'tiktok_cta', editedTikTok.cta)}
                      improving={improving === 'tiktok:tiktok_cta'}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── LINKEDIN ── */}
            {activeChannel === 'linkedin' && editedLinkedIn && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  <div>
                    <div className="text-[10px] text-[#3A3A3A] uppercase tracking-wider mb-2 px-1">Sponsored Preview</div>
                    <LinkedInAdPreview
                      headline={editedLinkedIn.headline}
                      intro_text={editedLinkedIn.intro_text}
                      cta={editedLinkedIn.cta}
                      brandName={brandName || 'Your Brand'}
                      image={adImages.linkedin}
                      onImageUpload={(url) => setAdImages((p) => ({ ...p, linkedin: url }))}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="text-[10px] text-[#3A3A3A] uppercase tracking-wider mb-2 px-1">Edit Copy</div>
                    <EditField
                      label="Headline"
                      hint={`${editedLinkedIn.headline.length}/70 chars`}
                      warn={editedLinkedIn.headline.length > 70}
                      value={editedLinkedIn.headline}
                      onChange={(v) => setEditedLinkedIn((p) => p ? { ...p, headline: v } : null)}
                      onImprove={() => handleImprove('linkedin', 'linkedin_headline', editedLinkedIn.headline)}
                      improving={improving === 'linkedin:linkedin_headline'}
                    />
                    <EditField
                      label="Intro Text"
                      hint={`${editedLinkedIn.intro_text.length}/150 chars`}
                      warn={editedLinkedIn.intro_text.length > 150}
                      value={editedLinkedIn.intro_text}
                      multiline
                      onChange={(v) => setEditedLinkedIn((p) => p ? { ...p, intro_text: v } : null)}
                      onImprove={() => handleImprove('linkedin', 'linkedin_intro', editedLinkedIn.intro_text)}
                      improving={improving === 'linkedin:linkedin_intro'}
                    />
                    <div>
                      <div className="text-[10px] text-[#555] mb-1.5">CTA Button</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(['LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'CONTACT_US', 'DOWNLOAD'] as const).map((c) => (
                          <button
                            key={c}
                            onClick={() => setEditedLinkedIn((p) => p ? { ...p, cta: c } : null)}
                            className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-all ${
                              editedLinkedIn.cta === c ? 'border-[#FAFAFA]/30 bg-[#FAFAFA]/8 text-[#FAFAFA]' : 'border-[#1E1E1E] text-[#555] hover:border-[#2A2A2A]'
                            }`}
                          >
                            {c.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Legacy meta-only angles */}
            {legacyResult && !goResult && (
              <div className="space-y-3">
                <div className="text-xs text-[#4A4A4A] px-1">ICP: {legacyResult.icp} · Value prop: {legacyResult.value_prop}</div>
                {editedAngles.map((angle, i) => (
                  <Card key={i} className={`cursor-pointer transition-all ${selectedIdx === i ? 'border-[#FAFAFA]/30' : 'border-[#1E1E1E]'}`} onClick={() => { setSelectedIdx(i); setEditedMeta({ headline: angle.headline, primary_text: angle.primary_text, cta: angle.cta }); }}>
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
                <CardDescription>
                  {channels.length > 1
                    ? `Deploying to ${channels.length} channels in parallel. Meta is live — other channels are simulated (Phase 2–4).`
                    : 'Demo mode works without a connected ad account.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-[#A1A1A1] mb-1.5 block">Brand Name (optional)</label>
                  <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g., Dentflow" />
                </div>

                {/* Per-channel deploy status rows */}
                <div className="rounded-lg border border-[#1E1E1E] divide-y divide-[#141414] overflow-hidden">
                  {channels.map((ch) => {
                    const opt = CHANNEL_OPTIONS.find((o) => o.id === ch)!;
                    const conn = connectedPlatforms.find((c) => c.platform === ch);
                    const status = channelStatuses[ch];
                    const err = channelErrors[ch];
                    return (
                      <div key={ch} className="flex items-center gap-3 px-4 py-3 text-sm">
                        <span className="text-base w-5">{opt.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium">{opt.label}</div>
                          <div className="text-[10px] text-[#444]">
                            {ch === 'meta'
                              ? conn ? 'Live deploy via Meta Marketing API' : 'Demo mode — no account connected'
                              : 'Simulated deploy (API integration in Phase 2–4)'}
                          </div>
                          {err && <div className="text-[10px] text-[#888] mt-0.5">{err}</div>}
                        </div>
                        <div className="shrink-0">
                          {!status && <span className="text-[10px] text-[#333] font-mono">READY</span>}
                          {status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#555]" />}
                          {(status === 'done' || status === 'demo') && <CheckCircle2 className="w-3.5 h-3.5 text-[#FAFAFA]" />}
                          {status === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-[#666]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary row */}
                <div className="rounded-lg border border-[#262626] divide-y divide-[#1E1E1E] text-sm">
                  <div className="flex justify-between px-4 py-2.5"><span className="text-[#4A4A4A]">Idea</span><span className="text-right max-w-[60%] truncate">{ideaFromRecord}</span></div>
                  <div className="flex justify-between px-4 py-2.5"><span className="text-[#4A4A4A]">Audience</span><span className="text-right max-w-[60%] truncate">{audience || '—'}</span></div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-[#4A4A4A]">Meta account</span>
                    <span className={activeAccountId ? 'text-[#FAFAFA]' : 'text-[#4A4A4A]'}>{activeAccountId ? 'Connected' : 'Not connected'}</span>
                  </div>
                </div>

                {deployError && (
                  <div className="flex items-start gap-2 p-3 rounded-md border border-[#2A2A2A] bg-[#141414] text-sm text-[#777]">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{deployError}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setStep(1)} disabled={deploying || demoDeploying}>
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Back
                  </Button>
                  <div className="flex-1" />
                  <Button variant="outline" onClick={() => handleDeploy(true)} disabled={demoDeploying || deploying}>
                    {demoDeploying
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Simulating {channels.length} channel{channels.length > 1 ? 's' : ''}…</>
                      : <><Zap className="w-4 h-4 mr-2" />Demo Deploy</>}
                  </Button>
                  <Button onClick={() => handleDeploy(false)} disabled={!activeAccountId || deploying || demoDeploying}>
                    {deploying
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Launching {channels.length} channel{channels.length > 1 ? 's' : ''}…</>
                      : <><ExternalLink className="w-4 h-4 mr-2" />Live Deploy</>}
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
