'use client';

/**
 * components/ad-preview.tsx
 *
 * Platform-specific ad preview mockups. Purely visual — no API calls.
 * Each component accepts the current copy + an optional image data-URL
 * and renders a faithful approximation of what the ad looks like in-feed.
 */

import { ImageIcon } from 'lucide-react';

// ── Shared ────────────────────────────────────────────────────────────────

interface ImageSlotProps {
  src?: string;
  onUpload: (dataUrl: string) => void;
  aspectClass?: string; // e.g. "aspect-video" or "aspect-square"
}

export function ImageSlot({ src, onUpload, aspectClass = 'aspect-video' }: ImageSlotProps) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onUpload(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <label className={`relative block w-full ${aspectClass} cursor-pointer overflow-hidden group`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Ad creative" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-[#111] border border-dashed border-[#2A2A2A] flex flex-col items-center justify-center gap-1.5 group-hover:border-[#444] transition-colors">
          <ImageIcon className="w-5 h-5 text-[#333]" />
          <span className="text-[10px] text-[#333] group-hover:text-[#555] transition-colors">Click to upload image</span>
        </div>
      )}
      {src && (
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-[11px] text-white">Replace image</span>
        </div>
      )}
      <input type="file" accept="image/*" className="sr-only" onChange={handleFile} />
    </label>
  );
}

// ── Meta Feed Ad ──────────────────────────────────────────────────────────

interface MetaPreviewProps {
  headline: string;
  primary_text: string;
  cta: string;
  brandName?: string;
  image?: string;
  onImageUpload: (dataUrl: string) => void;
}

export function MetaAdPreview({ headline, primary_text, cta, brandName = 'Your Brand', image, onImageUpload }: MetaPreviewProps) {
  const ctaLabel = cta.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="w-full max-w-[340px] mx-auto rounded-lg overflow-hidden border border-[#2A2A2A] bg-[#0F0F0F] font-sans select-none">
      {/* Post header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center text-[10px] font-bold text-[#555]">
          {brandName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-[#FAFAFA] truncate">{brandName}</div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#555]">Sponsored</span>
            <span className="text-[10px] text-[#444]">·</span>
            <span className="text-[10px] text-[#444]">🌐</span>
          </div>
        </div>
        <div className="text-[#444] text-lg leading-none">···</div>
      </div>

      {/* Primary text */}
      <div className="px-3 pb-2">
        <p className="text-[12px] text-[#CCCCCC] leading-relaxed line-clamp-3">{primary_text}</p>
      </div>

      {/* Image */}
      <ImageSlot src={image} onUpload={onImageUpload} aspectClass="aspect-[1.91/1]" />

      {/* Headline + CTA bar */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#141414] border-t border-[#1E1E1E]">
        <div className="flex-1 min-w-0 pr-2">
          <div className="text-[10px] text-[#555] truncate">launch-lense.vercel.app</div>
          <div className="text-[13px] font-semibold text-[#FAFAFA] leading-tight line-clamp-1">{headline}</div>
        </div>
        <button className="shrink-0 px-3 py-1.5 rounded bg-[#2A2A2A] text-[11px] font-semibold text-[#FAFAFA] hover:bg-[#333] transition-colors whitespace-nowrap">
          {ctaLabel}
        </button>
      </div>

      {/* Engagement bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#1A1A1A]">
        <span className="text-[10px] text-[#444]">👍 Like  💬 Comment  ↗ Share</span>
      </div>
    </div>
  );
}

// ── Google Search Ad ──────────────────────────────────────────────────────

interface GooglePreviewProps {
  headlines: string[];
  descriptions: string[];
  path1?: string;
  path2?: string;
  brandName?: string;
}

export function GoogleAdPreview({ headlines, descriptions, path1 = 'app', path2 = 'trial', brandName = 'yourbrand.com' }: GooglePreviewProps) {
  const domain = brandName.toLowerCase().replace(/\s+/g, '') + '.com';

  return (
    <div className="w-full max-w-[520px] mx-auto p-4 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] font-sans select-none space-y-0.5">
      {/* Sponsored badge */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] px-1.5 py-0.5 border border-[#2A2A2A] rounded text-[#555] font-medium">Sponsored</span>
        <span className="text-[11px] text-[#4A9EFF]">{domain}/{path1}/{path2}</span>
      </div>

      {/* Title — shows up to 3 headlines joined by | */}
      <div className="text-[18px] text-[#4A9EFF] font-normal leading-snug hover:underline cursor-pointer">
        {headlines.slice(0, 3).join(' | ')}
      </div>

      {/* Descriptions */}
      {descriptions.slice(0, 2).map((d, i) => (
        <p key={i} className="text-[13px] text-[#AAAAAA] leading-relaxed">{d}</p>
      ))}

      {/* Sitelinks */}
      <div className="flex gap-4 pt-1">
        {['Features', 'Pricing', 'Demo', 'Sign Up'].map((link) => (
          <span key={link} className="text-[12px] text-[#4A9EFF] hover:underline cursor-pointer">{link}</span>
        ))}
      </div>
    </div>
  );
}

// ── TikTok In-Feed Ad ──────────────────────────────────────────────────────

interface TikTokPreviewProps {
  hook: string;
  script: string[];
  ctaText: string;
  brandName?: string;
  image?: string;
  onImageUpload: (dataUrl: string) => void;
}

export function TikTokAdPreview({ hook, script, ctaText, brandName = 'Your Brand', image, onImageUpload }: TikTokPreviewProps) {
  return (
    <div className="w-full max-w-[240px] mx-auto rounded-2xl overflow-hidden border border-[#2A2A2A] bg-black select-none relative" style={{ aspectRatio: '9/16' }}>
      {/* Video background / image */}
      <div className="absolute inset-0">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="Ad video thumbnail" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-[#111] to-[#000]" />
        )}
        {/* Dark overlay for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      </div>

      {/* Upload overlay on empty */}
      {!image && (
        <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer gap-1.5 group z-10">
          <ImageIcon className="w-6 h-6 text-[#333] group-hover:text-[#555] transition-colors" />
          <span className="text-[10px] text-[#333] group-hover:text-[#555] transition-colors">Upload video thumbnail</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => onImageUpload(reader.result as string);
            reader.readAsDataURL(file);
          }} />
        </label>
      )}

      {/* Right actions (TikTok-style) */}
      <div className="absolute right-2 bottom-24 flex flex-col items-center gap-4 z-20">
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">❤️</div>
          <span className="text-[9px] text-white/60">2.4K</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">💬</div>
          <span className="text-[9px] text-white/60">142</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">↗</div>
          <span className="text-[9px] text-white/60">Share</span>
        </div>
      </div>

      {/* Bottom copy overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 z-20 space-y-1.5">
        <div className="text-[11px] font-semibold text-white/80">@{brandName.toLowerCase().replace(/\s+/g, '_')}</div>
        <p className="text-[13px] font-bold text-white leading-tight">{hook}</p>
        {script[0] && <p className="text-[11px] text-white/70 line-clamp-2">{script[0]}</p>}
        {/* CTA pill */}
        <div className="flex items-center gap-2 pt-0.5">
          <button className="px-3 py-1 rounded-full bg-[#FF0050] text-white text-[11px] font-bold">
            {ctaText}
          </button>
          <span className="text-[9px] text-white/40">Sponsored</span>
        </div>
      </div>
    </div>
  );
}

// ── LinkedIn Sponsored Content ─────────────────────────────────────────────

interface LinkedInPreviewProps {
  headline: string;
  intro_text: string;
  cta: string;
  brandName?: string;
  image?: string;
  onImageUpload: (dataUrl: string) => void;
}

export function LinkedInAdPreview({ headline, intro_text, cta, brandName = 'Your Brand', image, onImageUpload }: LinkedInPreviewProps) {
  return (
    <div className="w-full max-w-[400px] mx-auto rounded-lg overflow-hidden border border-[#2A2A2A] bg-[#0F0F0F] font-sans select-none">
      {/* Post header */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <div className="w-10 h-10 rounded-full bg-[#0A66C2]/20 border border-[#0A66C2]/30 flex items-center justify-center text-[12px] font-bold text-[#0A66C2]">
          {brandName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[#FAFAFA] truncate">{brandName}</div>
          <div className="text-[11px] text-[#555]">Sponsored · <span className="text-[#444]">🌐 Follow</span></div>
        </div>
      </div>

      {/* Intro text */}
      <div className="px-4 pb-2">
        <p className="text-[12px] text-[#AAAAAA] leading-relaxed line-clamp-3">{intro_text}</p>
      </div>

      {/* Image */}
      <ImageSlot src={image} onUpload={onImageUpload} aspectClass="aspect-[1.91/1]" />

      {/* Headline + CTA card */}
      <div className="px-4 py-3 bg-[#141414] border-t border-[#1E1E1E] space-y-2">
        <div className="text-[13px] font-semibold text-[#FAFAFA] leading-tight">{headline}</div>
        <button className="w-full py-2 rounded border border-[#3A3A3A] text-[12px] font-semibold text-[#AAAAAA] hover:border-[#555] hover:text-[#FAFAFA] transition-colors">
          {cta.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </button>
      </div>

      {/* Reactions bar */}
      <div className="px-4 py-2 flex items-center justify-between border-t border-[#1A1A1A]">
        <span className="text-[10px] text-[#444]">👍 Like  💬 Comment  ↗ Share</span>
        <span className="text-[10px] text-[#444]">Send →</span>
      </div>
    </div>
  );
}
