import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const META_APP_ID = process.env.META_APP_ID;
  const redirectUri = `${request.nextUrl.origin}/api/auth/meta/callback`;

  if (!META_APP_ID) {
    return Response.json(
      { error: 'META_APP_ID not configured' },
      { status: 500 }
    );
  }

  const scopes = ['ads_management', 'ads_read', 'business_management'];
  const authUrl = new URL('https://www.facebook.com/v20.0/dialog/oauth');
  authUrl.searchParams.set('client_id', META_APP_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes.join(','));
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', crypto.randomUUID());

  return Response.redirect(authUrl.toString());
}
