export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get('platform');
  if (platform && platform !== 'meta') {
    return Response.json({ error: 'Only Meta supported' }, { status: 400 });
  }

  const META_APP_ID = process.env.META_APP_ID;
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL || null;
  const APP_URL = request.nextUrl.origin;
  const redirectUri = `${APP_URL}/api/auth/meta/callback`;
  const state = crypto.randomUUID();

  if (!META_APP_ID) {
    return Response.json(
      { error: 'META_APP_ID not configured' },
      { status: 500 }
    );
  }

  const scopes = [
    'ads_management',
    'ads_read',
    'business_management',
    'pages_show_list',
    'pages_read_engagement',
  ];
  const authUrl = new URL('https://www.facebook.com/v20.0/dialog/oauth');
  authUrl.searchParams.set('client_id', META_APP_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes.join(','));
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);

  console.log('[oauth/start] META_OAUTH_START', {
    request_origin: request.nextUrl.origin,
    configured_app_url: configuredAppUrl,
    app_url: APP_URL,
    redirect_uri: redirectUri,
    state,
    scopes,
    user_agent: request.headers.get('user-agent') || 'unknown',
    host: request.headers.get('host') || 'unknown',
    x_forwarded_host: request.headers.get('x-forwarded-host') || 'unknown',
    x_forwarded_proto: request.headers.get('x-forwarded-proto') || 'unknown',
  });

  return Response.redirect(authUrl.toString());
}
