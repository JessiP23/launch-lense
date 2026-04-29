export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getGoogleConnection } from '@/lib/google/token-store';
import { oauthScopeKeyFromSprint } from '@/lib/google/sprint-scope';

export async function GET(req: NextRequest) {
  const sprintId = req.nextUrl.searchParams.get('sprint_id');
  if (!sprintId) {
    return Response.json({ error: 'Missing sprint_id' }, { status: 400 });
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

  const conn = await getGoogleConnection(scope_key);

  return Response.json({
    connected: Boolean(conn),
    google_email: conn?.google_email ?? null,
    updated_at: conn?.updated_at ?? null,
    oauth_configured: Boolean(
      process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_OAUTH_STATE_SECRET,
    ),
    encryption_configured: Boolean(process.env.GOOGLE_OAUTH_SECRET),
  });
}
