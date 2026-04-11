export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ORG_ID = '00000000-0000-0000-0000-000000000001'; // Default org for now

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
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

    // 5. Store each ad account in DB with raw token
    for (const acct of accountsData.data) {
      const metaAccountId = acct.id; // already has act_ prefix

      await supabaseAdmin
        .from('ad_accounts')
        .upsert(
          {
            org_id: ORG_ID,
            platform: 'meta',
            account_id: metaAccountId,
            access_token: accessToken,
            name: acct.name || metaAccountId,
          },
          { onConflict: 'account_id' }
        );
    }

    const firstAccount = accountsData.data[0];

    return Response.redirect(
      `${request.nextUrl.origin}/accounts/connect?connected=1&account_id=${firstAccount.id}`
    );
  } catch (err) {
    console.error('Meta callback error:', err);
    return Response.redirect(
      `${request.nextUrl.origin}/accounts/connect?error=callback_failed`
    );
  }
}
