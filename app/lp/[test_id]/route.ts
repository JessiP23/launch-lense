export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ test_id: string }> }
) {
  const { test_id } = await params;

  const { data: test } = await supabaseAdmin.from('tests').select('lp_html, lp_json, name, idea, angles').eq('id', test_id).single();

  // this approach returns status and statustext if found, returns a single row and not an array

  console.log('data testing:', test);

  if (!test) {
    const { data: sprint } = await supabaseAdmin
      .from('sprints')
      .select('idea, landing, angles')
      .eq('id', test_id)
      .single();

    if (!sprint) {
      return new Response('Not found', { status: 404 });
    }

    const landing = sprint.landing as { pages?: Array<{ html?: string }> } | null;
    const html = landing?.pages?.find((page) => typeof page.html === 'string' && page.html)?.html;
    if (html) {
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const angles = sprint.angles as { angles?: Array<{ copy?: { meta?: { headline?: string; body?: string } }; cta?: string }> } | null;
    const angle = angles?.angles?.[0];
    return new Response(generateFallback(
      angle?.copy?.meta?.headline || String(sprint.idea ?? 'LaunchLense Sprint'),
      String(sprint.idea ?? ''),
      angle ? { headline: angle.copy?.meta?.headline, primary_text: angle.copy?.meta?.body, cta: angle.cta } : null
    ), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // 1. Prefer explicitly stored HTML
  if (test.lp_html) {
    return new Response(test.lp_html as string, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // 2. HTML stored inside lp_json (fallback when lp_html column missing)
  const lpJson = test.lp_json as Record<string, unknown> | null;
  if (lpJson?.html && typeof lpJson.html === 'string') {
    return new Response(lpJson.html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // 3. Auto-generate from angle data
  const angle = Array.isArray(test.angles) ? test.angles[0] : null;
  const html = generateFallback(test.name as string, test.idea as string, angle);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function generateFallback(
  name: string,
  idea: string,
  angle: { headline?: string; primary_text?: string; cta?: string } | null
): string {
  const h = angle?.headline || name;
  const body = angle?.primary_text || idea;
  const cta = angle?.cta || 'Get Started';
  const pixelId = process.env.SYSTEM_META_PIXEL_ID || '1510106240565645';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(h)}</title>
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0A0A0A;color:#FAFAFA;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px 20px}
  .c{max-width:600px;text-align:center}
  h1{font-size:2.5rem;font-weight:700;line-height:1.15;margin-bottom:1.25rem}
  p{font-size:1.125rem;color:#A1A1A1;line-height:1.7;margin-bottom:2rem}
  a{display:inline-block;padding:14px 36px;background:#FAFAFA;color:#0A0A0A;border-radius:8px;font-weight:600;font-size:1rem;text-decoration:none}
  a:hover{opacity:.9}
</style>
</head>
<body>
<div class="c">
  <h1>${esc(h)}</h1>
  <p>${esc(body)}</p>
  <a href="#signup" onclick="if(window.fbq) fbq('track','Lead');">${esc(cta)}</a>
</div>

<script>
(function() {
  var testId = window.location.pathname.split('/').pop();
  fetch('/api/lp/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ test_id: testId, event: 'page_view', ts: Date.now() })
  }).catch(function() {});
  
  // Track CTA clicks
  document.querySelectorAll('a[href="#signup"]').forEach(function(el) {
    el.addEventListener('click', function() {
      if(window.fbq) fbq('track','Lead');
      fetch('/api/lp/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_id: testId, event: 'cta_click', ts: Date.now() })
      }).catch(function() {});
    });
  });
})();
</script>
</body>
</html>`;
}

function esc(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
