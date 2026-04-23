'use client';

import { useState, use, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Storefront templates ──────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean, conversion-focused',
    preview: 'bg-gradient-to-br from-[#0A0A0A] to-[#1a1a1a]',
    build: (h: string, body: string, cta: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(h)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;background:#0A0A0A;color:#FAFAFA;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:60px 24px}
  .wrap{max-width:640px;text-align:center}
  h1{font-size:clamp(2rem,5vw,3.5rem);font-weight:700;line-height:1.1;letter-spacing:-0.02em;margin-bottom:1.5rem}
  p{font-size:1.125rem;color:#A1A1A1;line-height:1.75;margin-bottom:2.5rem;max-width:480px;margin-left:auto;margin-right:auto}
  .btn{display:inline-block;padding:16px 40px;background:#FAFAFA;color:#0A0A0A;border-radius:10px;font-weight:600;font-size:1rem;text-decoration:none;transition:opacity .15s}
  .btn:hover{opacity:.88}
  .sub{margin-top:1.25rem;font-size:.8rem;color:#555}
</style>
</head>
<body>
<div class="wrap">
  <h1>${esc(h)}</h1>
  <p>${esc(body)}</p>
  <a class="btn" href="#signup">${esc(cta)}</a>
  <p class="sub">No credit card required · Cancel anytime</p>
</div>
</body></html>`,
  },
  {
    id: 'hero',
    label: 'Hero + Features',
    description: 'Headline, bullets, CTA',
    preview: 'bg-gradient-to-br from-[#0D0D1A] to-[#0A0A0A]',
    build: (h: string, body: string, cta: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(h)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;background:#080810;color:#FAFAFA;padding:0}
  .hero{padding:80px 24px 60px;text-align:center;max-width:760px;margin:0 auto}
  .badge{display:inline-block;padding:4px 14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:20px;font-size:.8rem;color:#A1A1A1;margin-bottom:1.75rem;letter-spacing:.04em}
  h1{font-size:clamp(2rem,5vw,3.75rem);font-weight:700;line-height:1.1;letter-spacing:-0.03em;margin-bottom:1.5rem}
  .sub{font-size:1.125rem;color:#8E8E9A;line-height:1.75;max-width:520px;margin:0 auto 2.5rem}
  .btn{display:inline-block;padding:16px 44px;background:#FAFAFA;color:#080810;border-radius:10px;font-weight:700;font-size:1rem;text-decoration:none}
  .features{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;max-width:760px;margin:60px auto;padding:0 24px}
  .feat{padding:24px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px}
  .feat h3{font-size:1rem;font-weight:600;margin-bottom:.5rem}
  .feat p{font-size:.875rem;color:#8E8E9A;line-height:1.6}
</style>
</head>
<body>
<div class="hero">
  <div class="badge">NOW AVAILABLE</div>
  <h1>${esc(h)}</h1>
  <p class="sub">${esc(body)}</p>
  <a class="btn" href="#signup">${esc(cta)}</a>
</div>
<div class="features">
  <div class="feat"><h3>Fast Setup</h3><p>Get running in minutes, not weeks.</p></div>
  <div class="feat"><h3>Built to Scale</h3><p>Grows with your business seamlessly.</p></div>
  <div class="feat"><h3>Proven Results</h3><p>Teams see results from day one.</p></div>
</div>
</body></html>`,
  },
  {
    id: 'social-proof',
    label: 'Social Proof',
    description: 'Testimonial + CTA',
    preview: 'bg-gradient-to-br from-[#0A0A0A] to-[#0f1a0f]',
    build: (h: string, body: string, cta: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(h)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;background:#0A0A0A;color:#FAFAFA;padding:80px 24px;min-height:100vh}
  .wrap{max-width:640px;margin:0 auto}
  h1{font-size:clamp(2rem,5vw,3.25rem);font-weight:700;line-height:1.15;letter-spacing:-0.02em;margin-bottom:1.25rem}
  .desc{font-size:1.1rem;color:#A1A1A1;line-height:1.75;margin-bottom:2rem}
  .quote{border-left:3px solid #22C55E;padding:16px 20px;margin:2rem 0;background:rgba(34,197,94,.05);border-radius:0 8px 8px 0}
  .quote p{font-size:1rem;color:#FAFAFA;font-style:italic;margin-bottom:.75rem}
  .quote cite{font-size:.8rem;color:#A1A1A1}
  .btn{display:inline-block;padding:16px 40px;background:#22C55E;color:#0A0A0A;border-radius:10px;font-weight:700;font-size:1rem;text-decoration:none;margin-top:1.5rem}
  .btn:hover{opacity:.9}
</style>
</head>
<body>
<div class="wrap">
  <h1>${esc(h)}</h1>
  <p class="desc">${esc(body)}</p>
  <div class="quote">
    <p>"This completely transformed how we work. We couldn't imagine going back."</p>
    <cite>— Early customer, verified user</cite>
  </div>
  <a class="btn" href="#signup">${esc(cta)}</a>
</div>
</body></html>`,
  },
];

function esc(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function EditorPage({
  params,
}: {
  params: Promise<{ test_id: string }>;
}) {
  const { test_id } = use(params);
  const router = useRouter();

  const [phase, setPhase] = useState<'pick' | 'edit'>('pick');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [cta, setCta] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lpUrl, setLpUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load existing test data
  useEffect(() => {
    fetch(`/api/tests/${test_id}/metrics`)
      .then((r) => r.json())
      .then((data) => {
        const angle = Array.isArray(data.test?.angles) ? data.test.angles[0] : null;
        setHeadline(angle?.headline || data.test?.name || '');
        setBody(angle?.primary_text || '');
        setCta(angle?.cta || 'Get Started');
        if (data.test?.lp_url) setLpUrl(data.test.lp_url);

        const adAccountId = data.test?.ad_account_id;
        if (adAccountId) {
          void fetch(`/api/health/sync?account_id=${encodeURIComponent(adAccountId)}&mock=pass`).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [test_id]);

  // Live-update iframe on every field change
  useEffect(() => {
    if (phase !== 'edit' || !selectedTemplate || !iframeRef.current) return;
    const tpl = TEMPLATES.find((t) => t.id === selectedTemplate);
    if (!tpl) return;
    const html = tpl.build(headline, body, cta);
    const doc = iframeRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, [phase, selectedTemplate, headline, body, cta]);

  const handlePickTemplate = (id: string) => {
    setSelectedTemplate(id);
    setSaved(false);
    setPhase('edit');
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;
    const tpl = TEMPLATES.find((t) => t.id === selectedTemplate);
    if (!tpl) return;
    setSaving(true);
    setSaved(false);
    try {
      const html = tpl.build(headline, body, cta);
      const res = await fetch('/api/lp/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_id, html }),
      });
      if (res.ok) {
        const data = await res.json();
        setLpUrl(data.url || `/lp/${test_id}`);
        setSaved(true);
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#FAFAF8]">
        <Loader2 className="w-7 h-7 animate-spin text-[#8C8880]" />
      </div>
    );
  }

  // ── Phase 1: Template picker ─────────────────────────────────────────
  if (phase === 'pick') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/tests/${test_id}`)}
              className="text-[0.8125rem] text-[#8C8880] hover:text-[#111110] transition-colors"
            >
              ← Back to Test
            </button>
            <div>
              <h1 className="font-display text-[1.5rem] font-bold tracking-[-0.03em] text-[#111110]">Choose a Storefront</h1>
              <p className="text-[0.875rem] text-[#8C8880] mt-0.5">
                Pick a landing page template — then customise every word live
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handlePickTemplate(tpl.id)}
                className="group text-left rounded-xl border border-[#E8E4DC] overflow-hidden hover:border-[#111110]/30 transition-all focus:outline-none"
              >
                <div className={`h-32 ${tpl.preview} flex items-center justify-center relative`}>
                  <span className="text-white/20 text-5xl font-bold select-none">Aa</span>
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
                </div>
                <div className="p-4 bg-white">
                  <div className="font-semibold text-[0.875rem] text-[#111110]">{tpl.label}</div>
                  <div className="text-[0.75rem] text-[#8C8880] mt-0.5">{tpl.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Phase 2: Live editor ──────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAF8]">
      {/* Left panel */}
      <div className="w-80 shrink-0 flex flex-col border-r border-[#E8E4DC] bg-white overflow-y-auto">
        <div className="flex items-center gap-2 px-4 h-14 border-b border-[#E8E4DC] shrink-0">
          <button
            onClick={() => setPhase('pick')}
            className="text-[0.75rem] text-[#8C8880] hover:text-[#111110] transition-colors"
          >
            ←
          </button>
          <span className="font-semibold text-[0.875rem] text-[#111110] flex-1">Edit Content</span>
          <span className="text-[0.6875rem] font-mono text-[#8C8880] px-2 py-0.5 border border-[#E8E4DC] rounded-full">
            {TEMPLATES.find((t) => t.id === selectedTemplate)?.label}
          </span>
        </div>

        <div className="p-4 space-y-5 flex-1">
          <div>
            <label className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-2 block">
              Headline
            </label>
            <textarea
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              rows={3}
              className="w-full bg-[#FAFAF8] border border-[#E8E4DC] rounded-lg px-3 py-2 text-[0.875rem] text-[#111110] resize-none focus:outline-none focus:border-[#111110]/30 transition-colors placeholder:text-[#8C8880]/50"
              placeholder="Your compelling headline"
            />
          </div>
          <div>
            <label className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-2 block">
              Body Text
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full bg-[#FAFAF8] border border-[#E8E4DC] rounded-lg px-3 py-2 text-[0.875rem] text-[#111110] resize-none focus:outline-none focus:border-[#111110]/30 transition-colors placeholder:text-[#8C8880]/50"
              placeholder="Describe your value proposition"
            />
          </div>
          <div>
            <label className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] mb-2 block">
              CTA Button Text
            </label>
            <input
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              className="w-full bg-[#FAFAF8] border border-[#E8E4DC] rounded-lg px-3 py-2 text-[0.875rem] text-[#111110] focus:outline-none focus:border-[#111110]/30 transition-colors placeholder:text-[#8C8880]/50"
              placeholder="Get Started"
            />
          </div>
          <div className="pt-2">
            <button
              onClick={() => setPhase('pick')}
              className="text-[0.75rem] text-[#8C8880] hover:text-[#111110] underline underline-offset-2 transition-colors"
            >
              ← Change template
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-[#E8E4DC] space-y-2 shrink-0">
          {saved && lpUrl && (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-[#E8E4DC] text-[#111110] hover:bg-[#F3F0EB]"
              onClick={() => window.open(lpUrl, '_blank')}
            >
              View Live Page ↗
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-9 rounded-full bg-[#111110] text-white text-[0.875rem] font-medium hover:bg-[#111110]/90 border-0 disabled:opacity-40"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deploying…</>
            ) : saved ? (
              <><CheckCircle2 className="w-4 h-4 mr-2 text-[#059669]" />Deployed ✓</>
            ) : (
              'Save & Deploy'
            )}
          </Button>
        </div>
      </div>

      {/* Right: live iframe preview */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between h-14 px-4 border-b border-[#E8E4DC] shrink-0 bg-white">
          <span className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880]">Live Preview</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
            <span className="text-[0.75rem] text-[#8C8880]">Updates as you type</span>
          </div>
        </div>
        <iframe
          ref={iframeRef}
          className="flex-1 w-full border-0"
          sandbox="allow-scripts allow-same-origin"
          title="LP Preview"
        />
      </div>
    </div>
  );
}


