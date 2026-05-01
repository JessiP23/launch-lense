export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { GOOGLE_WORKSPACE_SCOPES } from '@/lib/google/scopes';
import { requestAppOrigin } from '@/lib/google/public-url';
import { signOAuthState } from '@/lib/google/oauth-state';
import { oauthScopeKeyFromSprint } from '@/lib/google/sprint-scope';

export async function GET(req: NextRequest) {
  const sprintId = req.nextUrl.searchParams.get('sprint_id');
  if (!sprintId) {
    return Response.json({ error: 'Missing sprint_id' }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET;
  if (!clientId || !stateSecret) {
    return Response.json(
      { error: 'Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_OAUTH_STATE_SECRET)' },
      { status: 503 },
    );
  }

  const db = createServiceClient();
  const { data: sprint, error } = await db.from('sprints').select('id, org_id').eq('id', sprintId).maybeSingle();
  if (error || !sprint) {
    return Response.json({ error: 'Sprint not found' }, { status: 404 });
  }

  const scope_key = oauthScopeKeyFromSprint({
    id: sprint.id as string,
    org_id: (sprint.org_id as string | null) ?? null,
  });

  const state = signOAuthState({ sprint_id: sprintId, scope_key, ts: Date.now() }, stateSecret);
  const redirectUri = `${requestAppOrigin(req)}/api/integrations/google/callback`;

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_WORKSPACE_SCOPES);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);

  return Response.redirect(url.toString(), 302);
}
