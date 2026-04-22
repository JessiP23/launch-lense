'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { createTest, createDemoTest } from '../../new/actions';
import type { GoOutput, Platform } from '@/lib/prompts';
import {
  MetaAdPreview, GoogleAdPreview, TikTokAdPreview, LinkedInAdPreview,
} from '@/components/ad-preview';

// ── Types ──────────────────────────────────────────────────────────────────

interface LegacyAngle { headline: string; primary_text: string; cta: string; }
interface LegacyAIResult { icp: string; value_prop: string; angles: LegacyAngle[]; }

const CHANNEL_OPTIONS: { id: Platform; label: string; color: string;}[] = [
  { id: 'meta',     label: 'Meta (FB/IG)',  color: '#1877F2' },
  { id: 'google',   label: 'Google Ads',    color: '#4285F4' },
  { id: 'tiktok',  label: 'TikTok Ads',    color: '#FF0050' },
  { id: 'linkedin', label: 'LinkedIn',      color: '#0A66C2' },
];

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
        <span className="text-[0.75rem] text-[#8C8880] font-medium">{label}</span>
        {hint && <span className={`text-[0.6875rem] ${warn ? 'text-[#D97706]' : 'text-[#8C8880]'}`}>{hint}</span>}
      </div>
      <div className="flex items-start gap-1.5">
        {multiline ? (
          <Textarea
            value={value}
            rows={3}
            onChange={(e) => onChange(e.target.value)}
            className={`text-[0.8125rem] flex-1 border-[#E8E4DC] bg-[#FAFAF8] text-[#111110] placeholder:text-[#8C8880]/60 focus:ring-[#111110]/10 resize-none ${warn ? 'border-[#D97706]' : ''}`}
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`text-[0.8125rem] h-8 flex-1 border-[#E8E4DC] bg-[#FAFAF8] text-[#111110] placeholder:text-[#8C8880]/60 focus:ring-[#111110]/10 ${warn ? 'border-[#D97706]' : ''}`}
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
      className="shrink-0 w-7 h-7 mt-0.5 flex items-center justify-center rounded border border-[#E8E4DC] hover:bg-[#F3F0EB] bg-white transition-all disabled:opacity-50 text-[0.625rem] text-[#8C8880]"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : '✨'}
    </button>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TestSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { healthSnapshot, activeAccountId, orgId, connectedPlatforms } = useAppStore();

  const [step, setStep] = useState(0);

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
          const { idea} = JSON.parse(cached) as { idea: string;};
          setIdeaFromRecord(idea);
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
        <Loader2 className="w-6 h-6 animate-spin text-[#8C8880]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[0.8125rem] text-[#8C8880]">
          <button
            onClick={() => router.push('/tests/new')}
            className="hover:text-[#111110] transition-colors"
          >
            ← New Test
          </button>
          <span>/</span>
          <span className="font-mono text-[0.75rem] truncate max-w-[200px]">{id}</span>
        </div>
      </div>

      {/* ── STEP 0: Describe ── */}
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="describe" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
            <div className="bg-white rounded-xl border border-[#E8E4DC] p-5 space-y-4">
              <div>
                <p className="font-display text-[1.0625rem] font-bold tracking-[-0.01em] text-[#111110]">
                  Describe your campaign
                </p>
              </div>

              <div>
                <label className="text-[0.8125rem] text-[#8C8880] mb-1.5 block font-medium">Idea</label>
                <div className="px-3 py-2 rounded-lg border border-[#E8E4DC] bg-[#F3F0EB] text-[0.8125rem] text-[#111110]">
                  {ideaFromRecord || 'Loading…'}
                </div>
              </div>
              <div>
                <label className="text-[0.8125rem] text-[#8C8880] mb-1.5 block font-medium">Target Audience</label>
                <Input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="e.g., Dental office managers aged 30–50"
                  className="border-[#E8E4DC] bg-[#FAFAF8] text-[#111110] placeholder:text-[#8C8880]/60 focus:ring-[#111110]/10"
                />
              </div>
              <div>
                <label className="text-[0.8125rem] text-[#8C8880] mb-1.5 block font-medium">Offer / Hook</label>
                <Textarea
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  placeholder="e.g., 14-day free trial, no credit card required"
                  rows={2}
                  className="border-[#E8E4DC] bg-[#FAFAF8] text-[#111110] placeholder:text-[#8C8880]/60 focus:ring-[#111110]/10 resize-none"
                />
              </div>

              {/* Channel selector */}
              <div>
                <label className="text-[0.8125rem] text-[#8C8880] mb-2 block font-medium">Channels</label>
                <div className="grid grid-cols-2 gap-2">
                  {CHANNEL_OPTIONS.map((ch) => {
                    const conn = connectedPlatforms.find((c) => c.platform === ch.id);
                    const selected = channels.includes(ch.id);
                    return (
                      <button
                        key={ch.id}
                        onClick={() => toggleChannel(ch.id)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                          selected
                            ? 'border-[#111110] bg-[#F3F0EB]'
                            : 'border-[#E8E4DC] bg-white hover:bg-[#FAFAF8]'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[0.8125rem] font-medium text-[#111110]">{ch.label}</p>
                          <p className="text-[0.6875rem] text-[#8C8880]">
                            {conn ? 'Connected' : 'Demo mode'}
                          </p>
                        </div>
                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-[#111110] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleGenerate}
                  disabled={channels.length === 0 || generating}
                  className="h-9 px-5 rounded-full bg-[#111110] text-white text-[0.875rem] font-medium hover:bg-[#111110]/90 border-0 disabled:opacity-40"
                >
                  {generating ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Generating copy…</>
                  ) : (
                    'Generate Ad Copy'
                  )}
                </Button>
              </div>
            </div>
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
                    className={`px-3 py-1.5 rounded-full text-[0.8125rem] font-medium transition-all border ${
                      activeChannel === ch
                        ? 'bg-[#111110] border-[#111110] text-white'
                        : 'border-[#E8E4DC] text-[#8C8880] hover:bg-[#F3F0EB]'
                    }`}
                  >
                    {opt?.label}
                  </button>
                );
              })}
            </div>

            {/* ── META ── */}
            {activeChannel === 'meta' && editedMeta && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  <div>
                    <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-2">Live Preview</p>
                    <MetaAdPreview
                      headline={editedMeta.headline}
                      primary_text={editedMeta.primary_text}
                      cta={editedMeta.cta}
                      brandName={brandName || 'Your Brand'}
                      image={adImages.meta}
                      onImageUpload={(url) => setAdImages((p) => ({ ...p, meta: url }))}
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-2">Edit Copy</p>

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
                      <p className="text-[0.75rem] text-[#8C8880] font-medium mb-1.5">CTA Button</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'GET_QUOTE', 'BOOK_NOW'] as const).map((c) => (
                          <button
                            key={c}
                            onClick={() => setEditedMeta((p) => p ? { ...p, cta: c } : null)}
                            className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-medium border transition-all ${
                              editedMeta.cta === c
                                ? 'border-[#111110] bg-[#111110] text-white'
                                : 'border-[#E8E4DC] text-[#8C8880] hover:bg-[#F3F0EB]'
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
                    <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-2">SERP Preview</p>
                    <GoogleAdPreview
                      headlines={editedGoogle.headlines}
                      descriptions={editedGoogle.descriptions}
                      path1={editedGoogle.path1}
                      path2={editedGoogle.path2}
                      brandName={brandName}
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-2">Edit Copy</p>
                    <div>
                      <p className="text-[0.75rem] text-[#8C8880] font-medium mb-1.5">Headlines <span className="text-[#8C8880]/60">(max 30 chars each)</span></p>
                      <div className="space-y-1.5">
                        {editedGoogle.headlines.map((h, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <Input
                              value={h}
                              onChange={(e) => setEditedGoogle((p) => p ? { ...p, headlines: p.headlines.map((x, j) => j === i ? e.target.value : x) } : null)}
                              className={`text-[0.8125rem] h-8 border-[#E8E4DC] bg-[#FAFAF8] text-[#111110] focus:ring-[#111110]/10 ${h.length > 30 ? 'border-[#D97706]' : ''}`}
                            />
                            <span className={`text-[0.6875rem] w-6 text-right shrink-0 ${h.length > 30 ? 'text-[#D97706]' : 'text-[#8C8880]'}`}>{h.length}</span>
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
                      <p className="text-[0.75rem] text-[#8C8880] font-medium mb-1.5">Descriptions <span className="text-[#8C8880]/60">(max 90 chars each)</span></p>
                      <div className="space-y-1.5">
                        {editedGoogle.descriptions.map((d, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <Textarea
                              value={d}
                              rows={2}
                              onChange={(e) => setEditedGoogle((p) => p ? { ...p, descriptions: p.descriptions.map((x, j) => j === i ? e.target.value : x) } : null)}
                              className={`text-[0.8125rem] border-[#E8E4DC] bg-[#FAFAF8] text-[#111110] focus:ring-[#111110]/10 resize-none ${d.length > 90 ? 'border-[#D97706]' : ''}`}
                            />
                            <div className="flex flex-col gap-1">
                              <span className={`text-[0.6875rem] w-6 text-right shrink-0 ${d.length > 90 ? 'text-[#D97706]' : 'text-[#8C8880]'}`}>{d.length}</span>
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
                        <p className="text-[0.75rem] text-[#8C8880] font-medium mb-1.5">Keywords</p>
                        <div className="flex flex-wrap gap-1">
                          {editedGoogle.keywords.map((k) => (
                            <span key={k} className="text-[0.6875rem] px-2 py-0.5 bg-[#F3F0EB] border border-[#E8E4DC] rounded-full text-[#8C8880]">{k}</span>
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
                    <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-2">In-Feed Preview</p>
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
                    <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-2">Edit Script</p>
                    <EditField
                      label="Hook (first 3 seconds)"
                      hint="Bold claim or question — max 15 words"
                      value={editedTikTok.hook}
                      onChange={(v) => setEditedTikTok((p) => p ? { ...p, hook: v } : null)}
                      onImprove={() => handleImprove('tiktok', 'hook', editedTikTok.hook)}
                      improving={improving === 'tiktok:hook'}
                    />
                    <div>
                      <p className="text-[0.75rem] text-[#8C8880] font-medium mb-1.5">Script Beats</p>
                      <div className="space-y-1.5">
                        {editedTikTok.script.map((beat, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="text-[0.75rem] text-[#8C8880] mt-2 w-4 shrink-0">{i + 1}.</span>
                            <Textarea
                              value={beat}
                              rows={2}
                              onChange={(e) => setEditedTikTok((p) => p ? { ...p, script: p.script.map((x, j) => j === i ? e.target.value : x) } : null)}
                              className="text-[0.8125rem] flex-1 border-[#E8E4DC] bg-[#FAFAF8] text-[#111110] focus:ring-[#111110]/10 resize-none"
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
                    <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-2">Sponsored Preview</p>
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
                    <p className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-2">Edit Copy</p>
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
                      <p className="text-[0.75rem] text-[#8C8880] font-medium mb-1.5">CTA Button</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(['LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'CONTACT_US', 'DOWNLOAD'] as const).map((c) => (
                          <button
                            key={c}
                            onClick={() => setEditedLinkedIn((p) => p ? { ...p, cta: c } : null)}
                            className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-medium border transition-all ${
                              editedLinkedIn.cta === c
                                ? 'border-[#111110] bg-[#111110] text-white'
                                : 'border-[#E8E4DC] text-[#8C8880] hover:bg-[#F3F0EB]'
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
                <p className="text-[0.75rem] text-[#8C8880] px-1">ICP: {legacyResult.icp} · Value prop: {legacyResult.value_prop}</p>
                {editedAngles.map((angle, i) => (
                  <div
                    key={i}
                    className={`cursor-pointer bg-white rounded-xl border p-4 space-y-2 transition-all ${
                      selectedIdx === i ? 'border-[#111110]' : 'border-[#E8E4DC] hover:border-[#8C8880]'
                    }`}
                    onClick={() => { setSelectedIdx(i); setEditedMeta({ headline: angle.headline, primary_text: angle.primary_text, cta: angle.cta }); }}
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[0.6875rem] border-[#E8E4DC]">Angle {i + 1}</Badge>
                      {selectedIdx === i && <CheckCircle2 className="w-4 h-4 text-[#111110]" />}
                    </div>
                    <Input
                      value={angle.headline}
                      onChange={(e) => setEditedAngles((prev) => prev.map((a, j) => j === i ? { ...a, headline: e.target.value } : a))}
                      className="font-medium border-[#E8E4DC] bg-[#FAFAF8] text-[#111110]"
                    />
                    <Textarea
                      value={angle.primary_text}
                      rows={2}
                      onChange={(e) => setEditedAngles((prev) => prev.map((a, j) => j === i ? { ...a, primary_text: e.target.value } : a))}
                      className="border-[#E8E4DC] bg-[#FAFAF8] text-[#111110] resize-none"
                    />
                    <Badge variant="outline" className="text-[0.6875rem] border-[#E8E4DC]">{angle.cta}</Badge>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(0)}
                className="border-[#E8E4DC] text-[#111110] hover:bg-[#F3F0EB]"
              >
                ← Back
              </Button>
              <Button
                onClick={() => setStep(2)}
                className="h-9 px-5 rounded-full bg-[#111110] text-white text-[0.875rem] font-medium hover:bg-[#111110]/90 border-0"
              >
                Continue to Deploy →
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: Deploy ── */}
        {step === 2 && (
          <motion.div key="deploy" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
            <div className="bg-white rounded-xl border border-[#E8E4DC] p-5 space-y-4">
              <div>
                <p className="font-display text-[1.0625rem] font-bold tracking-[-0.01em] text-[#111110]">
                  Launch Campaign
                </p>
                <p className="text-[0.8125rem] text-[#8C8880] mt-0.5">
                  {channels.length > 1
                    ? `Deploying to ${channels.length} channels in parallel. Meta is live — other channels are simulated (Phase 2–4).`
                    : 'Demo mode works without a connected ad account.'}
                </p>
              </div>

              <div>
                <label className="text-[0.8125rem] text-[#8C8880] mb-1.5 block font-medium">Brand Name (optional)</label>
                <Input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g., Dentflow"
                  className="border-[#E8E4DC] bg-[#FAFAF8] text-[#111110] placeholder:text-[#8C8880]/60 focus:ring-[#111110]/10"
                />
              </div>

              {/* Per-channel deploy status rows */}
              <div className="rounded-xl border border-[#E8E4DC] divide-y divide-[#E8E4DC] overflow-hidden">
                {channels.map((ch) => {
                  const opt = CHANNEL_OPTIONS.find((o) => o.id === ch)!;
                  const conn = connectedPlatforms.find((c) => c.platform === ch);
                  const status = channelStatuses[ch];
                  const err = channelErrors[ch];
                  return (
                    <div key={ch} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.875rem] font-medium text-[#111110]">{opt.label}</p>
                        <p className="text-[0.6875rem] text-[#8C8880]">
                          {ch === 'meta'
                            ? conn ? 'Live deploy via Meta Marketing API' : 'Demo mode — no account connected'
                            : 'Simulated deploy (API integration in Phase 2–4)'}
                        </p>
                        {err && <p className="text-[0.6875rem] text-[#DC2626] mt-0.5">{err}</p>}
                      </div>
                      <div className="shrink-0">
                        {!status && <span className="text-[0.6875rem] text-[#8C8880] font-mono">READY</span>}
                        {status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8C8880]" />}
                        {(status === 'done' || status === 'demo') && <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />}
                        {status === 'error' && <span className="text-[0.6875rem] text-[#DC2626]">✗</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="rounded-xl border border-[#E8E4DC] divide-y divide-[#E8E4DC] text-[0.875rem]">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-[#8C8880]">Idea</span>
                  <span className="text-right max-w-[60%] truncate text-[#111110]">{ideaFromRecord}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-[#8C8880]">Audience</span>
                  <span className="text-right max-w-[60%] truncate text-[#111110]">{audience || '—'}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-[#8C8880]">Meta account</span>
                  <span className={activeAccountId ? 'text-[#059669]' : 'text-[#8C8880]'}>
                    {activeAccountId ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              </div>

              {deployError && (
                <div className="p-3 rounded-xl border border-[#DC2626]/20 bg-[#FEF2F2] text-[0.875rem] text-[#DC2626]">
                  {deployError}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(1)}
                  disabled={deploying || demoDeploying}
                  className="border-[#E8E4DC] text-[#111110] hover:bg-[#F3F0EB]"
                >
                  ← Back
                </Button>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  onClick={() => handleDeploy(true)}
                  disabled={demoDeploying || deploying}
                  className="border-[#E8E4DC] text-[#111110] hover:bg-[#F3F0EB]"
                >
                  {demoDeploying
                    ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Simulating…</>
                    : 'Demo Deploy'}
                </Button>
                <Button
                  onClick={() => handleDeploy(false)}
                  disabled={!activeAccountId || deploying || demoDeploying}
                  className="h-9 px-5 rounded-full bg-[#111110] text-white text-[0.875rem] font-medium hover:bg-[#111110]/90 border-0 disabled:opacity-40"
                >
                  {deploying
                    ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Launching…</>
                    : 'Live Deploy'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
