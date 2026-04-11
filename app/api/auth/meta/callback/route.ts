import { NextRequest } from 'next/server';

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
    // Exchange code for access token
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

    const accessToken = tokenData.access_token;

    // Get ad accounts
    const accountsRes = await fetch(
      `https://graph.facebook.com/v20.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
    );
    const accountsData = await accountsRes.json();

    if (!accountsData.data || accountsData.data.length === 0) {
      return Response.redirect(
        `${request.nextUrl.origin}/accounts/connect?error=no_accounts`
      );
    }

    // TODO: In production:
    // 1. Encrypt access_token to Vault
    // 2. Save ad_accounts to Supabase
    // 3. Trigger health sync for each account
    // 4. Associate with Clerk org

    const firstAccount = accountsData.data[0];

    return Response.redirect(
      `${request.nextUrl.origin}/accounts/${firstAccount.id}?connected=1`
    );
  } catch (err) {
    console.error('Meta callback error:', err);
    return Response.redirect(
      `${request.nextUrl.origin}/accounts/connect?error=callback_failed`
    );
  }
}
