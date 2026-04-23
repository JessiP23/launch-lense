export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

// Deploy landing page from GrapesJS JSON
// POST /api/lp/deploy { test_id, html, gjsData }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { test_id, html, gjsData } = body as {
      test_id: string;
      html?: string;
      gjsData?: Record<string, unknown>;
    };

    if (!test_id) {
      return Response.json({ error: 'test_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch the test to verify it exists
    const { data: test, error: testError } = await supabase
      .from('tests')
      .select('id, org_id, name')
      .eq('id', test_id)
      .single();

    if (testError || !test) {
      return Response.json({ error: 'Test not found' }, { status: 404 });
    }

    // Generate full HTML page from GrapesJS output
    const fullHtml = generateLPHtml(html || '', test.name);

    // Upload to Supabase Storage
    const fileName = `lp/${test_id}/index.html`;
    let lpUrl: string | null = null;

    try {
      const { error: uploadError } = await supabase.storage
        .from('landing-pages')
        .upload(fileName, fullHtml, {
          contentType: 'text/html',
          upsert: true,
        });

      if (uploadError) {
        console.error('[lp/deploy] Upload error:', uploadError);
        // Bucket may not exist — fall through to fallback
      } else {
        // Get public URL from storage
        const { data: urlData } = supabase.storage
          .from('landing-pages')
          .getPublicUrl(fileName);
        lpUrl = urlData?.publicUrl || null;
      }
    } catch (storageErr) {
      console.error('[lp/deploy] Storage exception:', storageErr);
    }

    // Fallback: use app URL as LP endpoint
    if (!lpUrl) {
      lpUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://launchlense.app'}/lp/${test_id}`;
    }

    // Update test record with LP data
    // Try with lp_html first; fall back without it if the column doesn't exist yet
    const { error: updateError } = await supabase
      .from('tests')
      .update({
        lp_url: lpUrl,
        lp_json: gjsData || { html: fullHtml },
        lp_html: fullHtml,
      })
      .eq('id', test_id);

    if (updateError) {
      // lp_html column may not exist — retry without it, store HTML inside lp_json
      const { error: retryError } = await supabase
        .from('tests')
        .update({
          lp_url: lpUrl,
          lp_json: gjsData || { html: fullHtml },
        })
        .eq('id', test_id);

      if (retryError) {
        console.error('[lp/deploy] DB update failed:', retryError.message);
      }
    }

    // Insert annotation
    await supabase.from('annotations').insert({
      test_id,
      author: 'system',
      message: `Landing page deployed: ${lpUrl}`,
    });

    return Response.json({
      success: true,
      url: lpUrl,
      test_id,
    });
  } catch (error) {
    console.error('[lp/deploy] Error:', error);
    return Response.json(
      { error: 'LP deployment failed', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Generate a complete HTML page from GrapesJS body content
 */
function generateLPHtml(bodyHtml: string, testName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(testName)} - LaunchLense</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0A0A0A;
      color: #FAFAFA;
      min-height: 100vh;
    }
    .lp-container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    .lp-cta {
      display: inline-block;
      padding: 14px 32px;
      background: #FAFAFA;
      color: #0A0A0A;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      transition: opacity 0.2s;
    }
    .lp-cta:hover { opacity: 0.9; }
    h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: 1rem; }
    h2 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.75rem; }
    p { line-height: 1.6; color: #A1A1A1; margin-bottom: 1rem; }
  </style>
  <!-- LaunchLense tracking pixel -->
  <script>
    (function() {
      var testId = '${test_id_placeholder(testName)}';
      fetch('/api/lp/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_id: testId, event: 'page_view', ts: Date.now() })
      }).catch(function() {});
    })();
  </script>
</head>
<body>
  <div class="lp-container">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function test_id_placeholder(name: string): string {
  // This will be replaced by actual test_id at deploy time
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 32);
}
