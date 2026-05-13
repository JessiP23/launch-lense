'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Meta-style preview cards — Feed / Story / Reel.
//
// These are pure presentational components: they render whatever copy +
// asset is passed in. They do NOT fetch anything. Owners are responsible
// for showing the preview that matches the live edit buffer.
//
// The layouts are visually approximate (we are not Meta) — the goal is to
// give founders a faithful sense of how the ad will read in-feed.
// ─────────────────────────────────────────────────────────────────────────────

import { type CSSProperties } from 'react';

const C = {
  ink: '#111110', muted: '#8C8880', border: '#E8E4DC',
  surface: '#FFFFFF', canvas: '#FAFAF8', faint: '#F3F0EB',
  brand: '#1877F2',
};

export interface MetaPreviewContent {
  brandName?: string;
  headline?: string | null;
  primaryText?: string | null;
  description?: string | null;
  cta?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  displayLink?: string | null;
}

const ctaLabel = (cta?: string | null) => {
  if (!cta) return 'Learn More';
  const map: Record<string, string> = {
    LEARN_MORE: 'Learn More',
    SIGN_UP: 'Sign Up',
    GET_QUOTE: 'Get Quote',
    CONTACT_US: 'Contact Us',
    SUBSCRIBE: 'Subscribe',
    DOWNLOAD: 'Download',
    GET_OFFER: 'Get Offer',
    BOOK_TRAVEL: 'Book Now',
    APPLY_NOW: 'Apply Now',
    SHOP_NOW: 'Shop Now',
  };
  return map[cta.toUpperCase()] ?? cta;
};

const cardBase: CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  overflow: 'hidden',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const headerRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px',
};

const avatar: CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  background: C.faint,
  color: C.ink,
  fontWeight: 800,
  fontSize: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const sponsorTag: CSSProperties = {
  fontSize: 11, color: C.muted, marginTop: 1,
};

function PreviewMedia({
  imageUrl, videoUrl, aspect, label,
}: {
  imageUrl?: string | null;
  videoUrl?: string | null;
  aspect: 'square' | '4:5' | '9:16';
  label: string;
}) {
  const aspectStyle: CSSProperties = {
    width: '100%',
    aspectRatio: aspect === 'square' ? '1 / 1' : aspect === '4:5' ? '4 / 5' : '9 / 16',
    background: C.faint,
    color: C.muted,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
    textTransform: 'uppercase',
    overflow: 'hidden',
    position: 'relative',
  };
  if (videoUrl) {
    return (
      <div style={aspectStyle}>
        <video src={videoUrl} muted loop playsInline autoPlay
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <div style={aspectStyle}>
        <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  return <div style={aspectStyle}>{label}</div>;
}

// ── Feed ──────────────────────────────────────────────────────────────────

export function MetaFeedPreview({ content }: { content: MetaPreviewContent }) {
  const brand = content.brandName?.trim() || 'Your Brand';
  const initial = brand.slice(0, 1).toUpperCase();
  return (
    <div style={cardBase}>
      <div style={headerRow}>
        <div style={avatar}>{initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{brand}</div>
          <div style={sponsorTag}>Sponsored</div>
        </div>
      </div>
      {content.primaryText && (
        <div style={{ padding: '0 12px 10px', fontSize: 13, color: C.ink, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
          {content.primaryText}
        </div>
      )}
      <PreviewMedia
        imageUrl={content.imageUrl}
        videoUrl={content.videoUrl}
        aspect="square"
        label="Image · 1:1"
      />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px',
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {content.displayLink ?? 'launchlense.com'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginTop: 2 }}>
            {content.headline?.trim() || 'Your headline'}
          </div>
          {content.description && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{content.description}</div>
          )}
        </div>
        <button style={{
          height: 32, padding: '0 12px',
          border: 'none', borderRadius: 8,
          background: C.faint, color: C.ink,
          fontWeight: 800, fontSize: 12, cursor: 'default',
        }}>{ctaLabel(content.cta)}</button>
      </div>
    </div>
  );
}

// ── Story ─────────────────────────────────────────────────────────────────

export function MetaStoryPreview({ content }: { content: MetaPreviewContent }) {
  const brand = content.brandName?.trim() || 'Your Brand';
  const initial = brand.slice(0, 1).toUpperCase();
  return (
    <div style={{ ...cardBase, background: C.ink, color: '#FFF', position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <PreviewMedia
          imageUrl={content.imageUrl}
          videoUrl={content.videoUrl}
          aspect="9:16"
          label="Story · 9:16"
        />
        <div style={{
          position: 'absolute', top: 10, left: 10, right: 10,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ ...avatar, background: '#FFFFFF22', color: '#FFF' }}>{initial}</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#FFF' }}>{brand}</div>
            <div style={{ fontSize: 10, color: '#FFFFFFAA' }}>Sponsored</div>
          </div>
        </div>
        {(content.headline || content.primaryText) && (
          <div style={{
            position: 'absolute', left: 10, right: 10, bottom: 60,
            background: '#00000088',
            backdropFilter: 'blur(6px)',
            color: '#FFF', borderRadius: 10, padding: '10px 12px',
            fontSize: 13, fontWeight: 700, lineHeight: 1.35,
          }}>
            {content.headline?.trim() || content.primaryText?.trim()}
          </div>
        )}
        <div style={{
          position: 'absolute', left: 12, right: 12, bottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <button style={{
            height: 36, padding: '0 16px',
            border: 'none', borderRadius: 999,
            background: '#FFF', color: C.ink,
            fontWeight: 800, fontSize: 13, cursor: 'default',
          }}>{ctaLabel(content.cta)}</button>
        </div>
      </div>
    </div>
  );
}

// ── Reel ──────────────────────────────────────────────────────────────────

export function MetaReelPreview({ content }: { content: MetaPreviewContent }) {
  const brand = content.brandName?.trim() || 'Your Brand';
  return (
    <div style={{ ...cardBase, background: C.ink, color: '#FFF', position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <PreviewMedia
          imageUrl={content.imageUrl}
          videoUrl={content.videoUrl}
          aspect="9:16"
          label="Reel · 9:16"
        />
        <div style={{
          position: 'absolute', left: 12, right: 70, bottom: 12,
          color: '#FFF',
        }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>@{brand.toLowerCase().replace(/\s+/g, '')}</div>
          {content.primaryText && (
            <div style={{
              fontSize: 12, marginTop: 4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.4,
            }}>
              {content.primaryText}
            </div>
          )}
          <button style={{
            marginTop: 8,
            height: 30, padding: '0 12px',
            border: '1px solid #FFFFFF55', borderRadius: 999,
            background: '#FFFFFF22', color: '#FFF',
            fontWeight: 700, fontSize: 12, cursor: 'default',
          }}>{ctaLabel(content.cta)}</button>
        </div>
        {/* Right-side reel actions */}
        <div style={{
          position: 'absolute', right: 10, bottom: 16,
          display: 'flex', flexDirection: 'column', gap: 14,
          color: '#FFF', fontSize: 11, fontWeight: 700,
          textAlign: 'center',
        }}>
          <div>♥<div>—</div></div>
          <div>💬<div>—</div></div>
          <div>↗<div>—</div></div>
        </div>
      </div>
    </div>
  );
}

// ── Switcher ──────────────────────────────────────────────────────────────

export type MetaPlacement = 'feed' | 'story' | 'reel';

export function MetaPreviewCard({
  placement, content,
}: { placement: MetaPlacement; content: MetaPreviewContent }) {
  if (placement === 'story') return <MetaStoryPreview content={content} />;
  if (placement === 'reel') return <MetaReelPreview content={content} />;
  return <MetaFeedPreview content={content} />;
}
