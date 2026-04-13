export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ORG_ID = '00000000-0000-0000-0000-000000000001'; // Default org for now

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorReason = searchParams.get('error_reason');
  const errorDescription = searchParams.get('error_description');
  const state = searchParams.get('state');

  if (error) {
    console.error('[oauth/callback] META_OAUTH_ERROR', {
      error,
      error_reason: errorReason,
      error_description: errorDescription,
      state,
      request_origin: request.nextUrl.origin,
      host: request.headers.get('host') || 'unknown',
      x_forwarded_host: request.headers.get('x-forwarded-host') || 'unknown',
      x_forwarded_proto: request.headers.get('x-forwarded-proto') || 'unknown',
    });
    return Response.redirect(
      `${request.nextUrl.origin}/accounts/connect?error=${error}`
    );
  }

  if (!code) {
    return Response.redirect(
      `${request.nextUrl.origin}/accounts/connect?error=no_code`
    );
  }

  const META_APP_ID = process.env.META_APP_ID!;
  const META_APP_SECRET = process.env.META_APP_SECRET!;
  const redirectUri = `${request.nextUrl.origin}/api/auth/meta/callback`;

  console.log('[oauth/callback] META_OAUTH_CALLBACK', {
    state,
    request_origin: request.nextUrl.origin,
    redirect_uri: redirectUri,
    host: request.headers.get('host') || 'unknown',
    x_forwarded_host: request.headers.get('x-forwarded-host') || 'unknown',
    x_forwarded_proto: request.headers.get('x-forwarded-proto') || 'unknown',
  });

  try {
    // 1. Exchange code for short-lived token
    const tokenUrl = new URL('https://graph.facebook.com/v20.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', META_APP_ID);
    tokenUrl.searchParams.set('client_secret', META_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      throw new Error(tokenData.error.message);
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Exchange for long-lived token (60 days)
    const longLivedUrl = new URL('https://graph.facebook.com/v20.0/oauth/access_token');
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', META_APP_ID);
    longLivedUrl.searchParams.set('client_secret', META_APP_SECRET);
    longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();

    const accessToken = longLivedData.access_token || shortLivedToken;

    // 3. Get ad accounts
    const accountsRes = await fetch(
      `https://graph.facebook.com/v20.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
    );
    const accountsData = await accountsRes.json();

    if (!accountsData.data || accountsData.data.length === 0) {
      return Response.redirect(
        `${request.nextUrl.origin}/accounts/connect?error=no_accounts`
      );
    }

    // 4. Ensure org exists
    await supabaseAdmin
      .from('organizations')
      .upsert({ id: ORG_ID, name: 'My Studio' }, { onConflict: 'id' });

    // 5. Store each ad account in DB with Vault token reference
    for (const acct of accountsData.data) {
      const metaAccountId = acct.id; // already has act_ prefix
      const { data: vault_id, error: vaultErr } = await supabaseAdmin.rpc('create_secret', {
        secret: accessToken,
        name: `ad_token_${metaAccountId}`,
      });

      if (vaultErr) {
        const isDev = process.env.NODE_ENV !== 'production';
        if (!isDev) {
          throw vaultErr;
        }
        // Local/dev projects may not expose vault RPC helpers yet.
        // In development only, fall back to raw token storage so OAuth connect flow still succeeds.
        console.warn('[oauth] VAULT_STORE_FALLBACK_DEV_ONLY:', {
          account_id: metaAccountId,
          error_code: (vaultErr as { code?: string }).code,
          error_message: vaultErr.message,
        });
      } else {
        console.log('[oauth] VAULT_STORE:', { vault_id });
      }

      await supabaseAdmin
        .from('ad_accounts')
        .upsert(
          {
            org_id: ORG_ID,
            platform: 'meta',
            account_id: metaAccountId,
            access_token: vault_id || (process.env.NODE_ENV !== 'production' ? accessToken : null),
            name: acct.name || metaAccountId,
            page_id: null,
          },
          { onConflict: 'account_id' }
        );
    }

    const firstAccount = accountsData.data[0];

    // Look up the internal DB id for the first account
    const { data: dbAccount } = await supabaseAdmin
      .from('ad_accounts')
      .select('id')
      .eq('account_id', firstAccount.id)
      .single();

    const internalId = dbAccount?.id || firstAccount.id;

    return Response.redirect(
      `${request.nextUrl.origin}/accounts/connect?connected=1&account_id=${encodeURIComponent(internalId)}&meta_account_id=${encodeURIComponent(firstAccount.id)}&org_id=${encodeURIComponent(ORG_ID)}`
    );
  } catch (err) {
    console.error('Meta callback error:', err);
    return Response.redirect(
      `${request.nextUrl.origin}/accounts/connect?error=callback_failed`
    );
  }
}
