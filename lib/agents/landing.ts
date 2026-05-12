// ─────────────────────────────────────────────────────────────────────────────
// LandingPageAgent — Generates investor-grade validation LPs from AngleAgent output.
//
// Each landing page:
//  - Is generated server-side from a single angle
//  - Includes hero, proof, form, and trust sections
//  - Injects UTM attribution and full conversion event tracking
//  - Is mobile-first, sanitized against XSS, and marked noindex
//  - Tracks: page_view, cta_click, scroll_depth (25/50/75/100%), form_submit, email_capture
// ─────────────────────────────────────────────────────────────────────────────

import type { Angle, LandingPage, LandingSection, LandingAgentOutput, Platform } from './types';
import { DOMPurify as purify } from './landing-sanitize';

// ── HTML generation ───────────────────────────────────────────────────────

function escapedText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function buildSections(angle: Angle, channel: Platform): LandingSection[] {
  const copy = angle.copy;

  const heroHeadline =
    channel === 'meta' ? copy.meta.headline
    : channel === 'google' ? copy.google.headline1
    : channel === 'linkedin' ? copy.linkedin.headline
    : copy.tiktok.hook.slice(0, 60);

  const heroSub =
    channel === 'meta' ? copy.meta.body
    : channel === 'google' ? copy.google.description
    : channel === 'linkedin' ? copy.linkedin.body
    : copy.tiktok.overlay;

  return [
    {
      type: 'hero',
      headline: heroHeadline,
      subheadline: heroSub,
      cta_label: angle.cta || 'Get Early Access',
    },
    {
      type: 'proof',
      bullets: [
        '48-hour validation sprint',
        'No commitment required',
        'Join other early adopters',
      ],
    },
    {
      type: 'form',
      headline: 'Reserve your spot',
      cta_label: angle.cta || 'Get Early Access',
    },
    {
      type: 'trust',
      quote: 'We needed to know before building. This showed us the signal clearly.',
      quote_attribution: 'Early beta tester',
    },
  ];
}

function buildMetaPixelScript(pixelId: string): string {
  if (!pixelId) return '';
  return `<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');
fbq('track','PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel -->`;
}

function buildTrackingScript(recordId: string, angleId: string, channel: Platform, utmBase: string, pixelId: string): string {
  const pixelLead = pixelId
    ? `\n  // Fire Meta Pixel Lead event on form submit\n  if(window.fbq) fbq('track','Lead');`
    : '';
  const pixelInitiateCheckout = pixelId
    ? `\n  // Fire Meta Pixel InitiateCheckout on CTA click\n  if(window.fbq) fbq('track','InitiateCheckout');`
    : '';

  return `<script>
(function() {
  var RECORD_ID = '${escapedText(recordId)}';
  var ANGLE_ID = '${escapedText(angleId)}';
  var CHANNEL = '${escapedText(channel)}';
  var utmParams = (function() {
    var s = window.location.search;
    var m = {};
    s.replace(/[?&]([^=&]+)=([^&]*)/g, function(_, k, v) { m[decodeURIComponent(k)] = decodeURIComponent(v); });
    return m;
  })();

  function track(event, extra) {
    var payload = Object.assign({
      sprint_id: RECORD_ID,
      angle_id: ANGLE_ID,
      channel: CHANNEL,
      utm_source: utmParams.utm_source || CHANNEL,
      utm_medium: utmParams.utm_medium || 'paid',
      utm_campaign: utmParams.utm_campaign || 'sprint',
      utm_content: utmParams.utm_content || ANGLE_ID,
    }, extra || {});
    fetch('/api/lp/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprint_id: RECORD_ID, event: event, angle_id: ANGLE_ID, channel: CHANNEL,
        utm_source: payload.utm_source, utm_medium: payload.utm_medium,
        utm_campaign: payload.utm_campaign, utm_content: payload.utm_content,
        metadata: extra || {}, ts: Date.now() }),
      keepalive: true
    }).catch(function() {});
  }

  // page_view on load
  track('page_view');

  // scroll_depth at 25 / 50 / 75 / 100 %
  var scrollMilestones = { 25: false, 50: false, 75: false, 100: false };
  window.addEventListener('scroll', function() {
    var scrolled = (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100;
    [25, 50, 75, 100].forEach(function(pct) {
      if (!scrollMilestones[pct] && scrolled >= pct) {
        scrollMilestones[pct] = true;
        track('scroll_depth', { depth_pct: pct });
      }
    });
  }, { passive: true });

  // cta_click
  document.querySelectorAll('[data-lp-cta]').forEach(function(el) {
    el.addEventListener('click', function() {
      track('cta_click');${pixelInitiateCheckout}
    });
  });

  // form_submit + email_capture
  document.querySelectorAll('[data-lp-form]').forEach(function(form) {
    form.addEventListener('submit', function(e) {
      track('form_submit');
      var emailInput = form.querySelector('input[type="email"]');
      if (emailInput && emailInput.value) track('email_capture', { email_domain: emailInput.value.split('@')[1] || '' });${pixelLead}
    });
  });
})();
</script>`;
}

function buildLpHtml(
  recordId: string,
  angle: Angle,
  sections: LandingSection[],
  channel: Platform,
  utmBase: string,
  pixelId = ''
): string {
  const hero = sections.find((s) => s.type === 'hero');
  const proof = sections.find((s) => s.type === 'proof');
  const form = sections.find((s) => s.type === 'form');
  const trust = sections.find((s) => s.type === 'trust');

  const headline = escapedText(hero?.headline ?? angle.copy.meta.headline);
  const subheadline = escapedText(hero?.subheadline ?? angle.copy.meta.body);
  const ctaLabel = escapedText(hero?.cta_label ?? angle.cta ?? 'Get Early Access');
  const bullets = (proof?.bullets ?? []).map((b) => `<li>${escapedText(b)}</li>`).join('\n');
  const quote = trust?.quote ? `<blockquote class="trust-quote"><p>"${escapedText(trust.quote)}"</p><cite>— ${escapedText(trust.quote_attribution ?? '')}</cite></blockquote>` : '';
  const metaPixelScript = buildMetaPixelScript(pixelId);
  const trackingScript = buildTrackingScript(recordId, angle.id, channel, utmBase, pixelId);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${headline}</title>
  ${metaPixelScript}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --canvas: #FAFAF8; --ink: #111110; --muted: #8C8880;
      --border: #E8E4DC; --go: #059669; --faint: #F3F0EB;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--canvas); color: var(--ink); line-height: 1.6; }
    .wrapper { max-width: 680px; margin: 0 auto; padding: 48px 24px 80px; }
    .hero { padding: 48px 0 40px; }
    .hero h1 { font-size: clamp(1.75rem, 5vw, 2.75rem); font-weight: 700; line-height: 1.2; letter-spacing: -0.02em; }
    .hero p { margin-top: 16px; font-size: 1.125rem; color: var(--muted); max-width: 520px; }
    .cta-btn { display: inline-block; margin-top: 32px; padding: 14px 32px; background: var(--ink); color: var(--canvas); font-size: 1rem; font-weight: 600; border-radius: 6px; text-decoration: none; border: none; cursor: pointer; transition: opacity .15s; }
    .cta-btn:hover { opacity: 0.85; }
    .proof { padding: 32px 0; border-top: 1px solid var(--border); }
    .proof ul { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 24px; margin-top: 12px; }
    .proof ul li::before { content: '✓'; color: var(--go); margin-right: 8px; }
    .proof ul li { color: var(--muted); font-size: 0.9rem; }
    .form-section { padding: 40px 0; }
    .form-section h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 20px; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .form-row input[type="email"] { flex: 1; min-width: 200px; padding: 12px 16px; border: 1px solid var(--border); border-radius: 6px; font-size: 1rem; background: #fff; outline: none; }
    .form-row input[type="email"]:focus { border-color: var(--ink); }
    .form-row button { padding: 12px 28px; background: var(--ink); color: var(--canvas); font-size: 1rem; font-weight: 600; border: none; border-radius: 6px; cursor: pointer; white-space: nowrap; }
    .trust-quote { margin: 40px 0; padding: 20px 24px; border-left: 3px solid var(--border); background: var(--faint); border-radius: 0 6px 6px 0; }
    .trust-quote p { font-size: 1rem; color: var(--ink); }
    .trust-quote cite { display: block; margin-top: 8px; font-size: 0.85rem; color: var(--muted); font-style: normal; }
    .footer { margin-top: 48px; font-size: 0.8rem; color: var(--muted); text-align: center; border-top: 1px solid var(--border); padding-top: 24px; }
    @media (max-width: 480px) { .hero h1 { font-size: 1.6rem; } .form-row { flex-direction: column; } }
  </style>
</head>
<body>
  <div class="wrapper">
    <section class="hero">
      <h1>${headline}</h1>
      <p>${subheadline}</p>
      <a href="#waitlist" class="cta-btn" data-lp-cta>${ctaLabel}</a>
    </section>

    <section class="proof">
      <ul>${bullets}</ul>
    </section>

    <section class="form-section" id="waitlist">
      <h2>${escapedText(form?.headline ?? 'Reserve your spot')}</h2>
      <form data-lp-form action="#" onsubmit="return false;">
        <div class="form-row">
          <input type="email" placeholder="your@email.com" required aria-label="Email address" />
          <button type="submit" data-lp-cta>${escapedText(form?.cta_label ?? ctaLabel)}</button>
        </div>
      </form>
    </section>

    ${quote}

    <footer class="footer">
      <p>No spam. No commitment. Unsubscribe anytime.</p>
    </footer>
  </div>
  ${trackingScript}
</body>
</html>`;
}

// ── Runner ────────────────────────────────────────────────────────────────

export interface LandingPageAgentInput {
  recordId: string;            // sprint_id or test_id
  angles: [Angle, Angle, Angle];
  primaryChannel?: Platform;
  baseUrl?: string;
  /** Meta Pixel ID — injected into LP <head>. Reads SYSTEM_META_PIXEL_ID env if omitted. */
  pixelId?: string;
}

/**
 * Generate landing pages for up to 3 angles (one per active channel).
 * Each page includes the Meta Pixel for conversion tracking back to the campaign.
 */
export function runLandingPageAgent(input: LandingPageAgentInput): LandingAgentOutput {
  const {
    recordId,
    angles,
    primaryChannel = 'meta',
    baseUrl = '',
    pixelId = process.env.SYSTEM_META_PIXEL_ID ?? '',
  } = input;

  const pages: LandingPage[] = angles.map((angle) => {
    const utmBase = `${baseUrl}/lp/${recordId}`;
    const sections = buildSections(angle, primaryChannel);
    const html = buildLpHtml(recordId, angle, sections, primaryChannel, utmBase, pixelId);

    return {
      angle_id: angle.id,
      sections,
      html,
      utm_base: utmBase,
    };
  });

  return { pages };
}

// ── Sanitize shim ─────────────────────────────────────────────────────────
// We sanitize user-provided HTML (from GrapesJS editor) before storage.
// The agent-generated HTML above is already safe (only escapedText values).

export function sanitizeLpHtml(html: string): string {
  // Server-side: strip scripts and event handlers from user-provided editor HTML
  // Full DOMPurify requires a DOM; for server we strip the most dangerous patterns.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=/gi, ' data-removed=')
    .replace(/javascript:/gi, 'data:')
    .slice(0, 500_000); // hard cap
}
