// ─────────────────────────────────────────────────────────────────────────────
// Meta Pixel Tracking Utility for LaunchLense
//
// Maps LaunchLense validation events to Meta Pixel standard events.
// Focus: demand signal tracking, not e-commerce metrics.
// ─────────────────────────────────────────────────────────────────────────────

export interface MetaPixelConfig {
  pixelId: string;
}

/**
 * LaunchLense internal events → Meta Pixel standard events mapping
 * 
 * Validation philosophy: track demand signals, not vanity metrics
 */
export const LAUNCHLENSE_TO_META_EVENTS: Record<string, string> = {
  // Landing page engagement
  'page_view': 'PageView',
  'view_content': 'ViewContent',
  
  // Validation signals (critical)
  'cta_click': 'Lead',
  'form_submit': 'Lead',
  'email_capture': 'CompleteRegistration',
  
  // Deep engagement
  'scroll_depth': 'ViewContent',
  
  // Not used in LaunchLense (e-commerce only):
  // - AddToCart, Purchase, Search, Schedule, etc.
} as const;

/**
 * Generate Meta Pixel base code
 */
export function generateMetaPixelBase(pixelId: string): string {
  return `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');
fbq('track','PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`;
}

/**
 * Generate Meta Pixel event tracking code
 */
export function generateMetaPixelEvent(
  launchLenseEvent: string,
  params?: Record<string, unknown>
): string {
  const metaEvent = LAUNCHLENSE_TO_META_EVENTS[launchLenseEvent] || 'ViewContent';
  
  if (params && Object.keys(params).length > 0) {
    const paramsStr = JSON.stringify(params).replace(/"/g, "'");
    return `if(window.fbq) fbq('track','${metaEvent}',${paramsStr});`;
  }
  
  return `if(window.fbq) fbq('track','${metaEvent}');`;
}

/**
 * Generate complete tracking script for landing pages
 */
export function generateLpTrackingScript(
  recordId: string,
  angleId: string,
  channel: string,
  pixelId: string
): string {
  const pixelBase = generateMetaPixelBase(pixelId);
  
  return `${pixelBase}
<script>
(function() {
  var RECORD_ID = '${recordId}';
  var ANGLE_ID = '${angleId}';
  var CHANNEL = '${channel}';

  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function writeCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + (days * 86400000));
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }
  function uuid() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random()*16|0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
  }

  var utmParams = (function() {
    var s = window.location.search;
    var m = {};
    s.replace(/[?&]([^=&]+)=([^&]*)/g, function(_, k, v) { m[decodeURIComponent(k)] = decodeURIComponent(v); });
    return m;
  })();

  // ── fbclid → _fbc cookie (90-day) per Meta CAPI spec ──────────────────
  var fbclid = utmParams.fbclid || null;
  if (fbclid) writeCookie('_fbc', 'fb.1.' + Date.now() + '.' + fbclid, 90);
  var fbc = readCookie('_fbc');
  var fbp = readCookie('_fbp');

  // Internal tracking to LaunchLense (always paired with browser pixel via event_id)
  function track(event, extra, eventId) {
    var eid = eventId || uuid();
    fetch('/api/lp/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sprint_id: RECORD_ID,
        event: event,
        event_id: eid,
        angle_id: ANGLE_ID,
        channel: CHANNEL,
        utm_source: utmParams.utm_source || CHANNEL,
        utm_medium: utmParams.utm_medium || 'paid',
        utm_campaign: utmParams.utm_campaign || 'sprint',
        utm_content: utmParams.utm_content || ANGLE_ID,
        fbclid: fbclid,
        fbc: fbc,
        fbp: fbp,
        page_url: window.location.href,
        metadata: extra || {},
        ts: Date.now()
      }),
      keepalive: true
    }).catch(function() {});
    return eid;
  }
  function fbqTrack(name, params, eventId) {
    if (!window.fbq) return;
    if (eventId) fbq('track', name, params || {}, { eventID: eventId });
    else fbq('track', name, params || {});
  }

  // Page view on load (browser fbq init already fired PageView; dedupe via event_id)
  var pvId = track('page_view');
  if (window.fbq && pvId) fbqTrack('PageView', null, pvId);

  // Scroll depth
  var scrollMilestones = { 25: false, 50: false, 75: false, 100: false };
  window.addEventListener('scroll', function() {
    var scrolled = (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100;
    [25, 50, 75, 100].forEach(function(pct) {
      if (!scrollMilestones[pct] && scrolled >= pct) {
        scrollMilestones[pct] = true;
        var id = track('scroll_depth', { depth_pct: pct });
        fbqTrack('ViewContent', { depth_pct: pct }, id);
      }
    });
  }, { passive: true });

  // CTA clicks
  document.querySelectorAll('[data-lp-cta]').forEach(function(el) {
    el.addEventListener('click', function() {
      var id = track('cta_click');
      fbqTrack('Lead', null, id);
    });
  });

  // Form submissions
  document.querySelectorAll('[data-lp-form]').forEach(function(form) {
    form.addEventListener('submit', function(e) {
      var id = track('form_submit');
      fbqTrack('Lead', null, id);
      var emailInput = form.querySelector('input[type="email"]');
      if (emailInput && emailInput.value) {
        var emailId = track('email_capture', {
          email: emailInput.value,
          email_domain: emailInput.value.split('@')[1] || ''
        });
        fbqTrack('CompleteRegistration', null, emailId);
      }
    });
  });
})();
</script>`;
}
