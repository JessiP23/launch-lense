export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { exchangeAuthorizationCode } from '@/lib/google/oauth-http';
import { requestAppOrigin } from '@/lib/google/public-url';
import { verifyOAuthState } from '@/lib/google/oauth-state';
import { fetchGoogleUserEmail } from '@/lib/google/userinfo';
import { saveGoogleRefreshToken } from '@/lib/google/token-store';

function redirect(req: NextRequest, path: string) {
  return Response.redirect(`${requestAppOrigin(req)}${path}`, 302);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const stateStr = url.searchParams.get('state');
  const oauthErr = url.searchParams.get('error');

  if (oauthErr) {
    return redirect(req, `/canvas?panel=integrations&google_error=${encodeURIComponent(oauthErr)}`);
  }
  if (!code || !stateStr) {
    return redirect(req, '/canvas?panel=integrations&google_error=missing_params');
  }

  const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!stateSecret || !clientId || !clientSecret) {
    return redirect(req, '/canvas?panel=integrations&google_error=oauth_not_configured');
  }

  const parsed = verifyOAuthState(stateStr, stateSecret);
  if (!parsed) {
    return redirect(req, '/canvas?panel=integrations&google_error=invalid_state');
  }

  const redirectUri = `${requestAppOrigin(req)}/api/integrations/google/callback`;

  let tokens: Awaited<ReturnType<typeof exchangeAuthorizationCode>>;
  try {
    tokens = await exchangeAuthorizationCode({
      code,
      redirectUri,
      clientId,
      clientSecret,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'token_exchange_failed';
    return redirect(
      req,
      `/canvas/${encodeURIComponent(parsed.sprint_id)}?panel=integrations&google_error=${encodeURIComponent(msg)}`
    );
  }

  const refresh = tokens.refresh_token;
  if (!refresh) {
    return redirect(
      req,
      `/canvas/${encodeURIComponent(parsed.sprint_id)}?panel=integrations&google_error=no_refresh_token`
    );
  }

  let email: string | null = null;
  try {
    email = await fetchGoogleUserEmail(tokens.access_token);
  } catch {
    email = null;
  }

  const scopes = tokens.scope?.split(/\s+/).filter(Boolean) ?? [];

  try {
    await saveGoogleRefreshToken({
      scopeKey: parsed.scope_key,
      refreshToken: refresh,
      googleEmail: email,
      scopes,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'save_failed';
    return redirect(
      req,
      `/canvas/${encodeURIComponent(parsed.sprint_id)}?panel=integrations&google_error=${encodeURIComponent(msg)}`
    );
  }

  const db = createServiceClient();
  const { data: row } = await db.from('sprints').select('integrations').eq('id', parsed.sprint_id).maybeSingle();

  const prev =
    row?.integrations && typeof row.integrations === 'object'
      ? { ...(row.integrations as Record<string, unknown>) }
      : {};

  await db
    .from('sprints')
    .update({
      integrations: {
        ...prev,
        gmail_connected: true,
        sheets_connected: true,
        google_connected_email: email,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.sprint_id);

  return redirect(req, `/canvas/${encodeURIComponent(parsed.sprint_id)}?panel=integrations&google_connected=1`);
}
