export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { deleteGoogleTokens } from '@/lib/google/token-store';
import { oauthScopeKeyFromSprint } from '@/lib/google/sprint-scope';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { sprint_id?: string };
  const sprintId = body.sprint_id;
  if (!sprintId) {
    return Response.json({ error: 'Missing sprint_id' }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: sprint, error } = await db.from('sprints').select('id, org_id, integrations').eq('id', sprintId).maybeSingle();
  if (error || !sprint) {
    return Response.json({ error: 'Sprint not found' }, { status: 404 });
  }

  const scope_key = oauthScopeKeyFromSprint({
    id: sprint.id as string,
    org_id: (sprint.org_id as string | null) ?? null,
  });

  await deleteGoogleTokens(scope_key);

  const prev =
    sprint.integrations && typeof sprint.integrations === 'object'
      ? { ...(sprint.integrations as Record<string, unknown>) }
      : {};

  const { data: updated, error: upErr } = await db
    .from('sprints')
    .update({
      integrations: {
        ...prev,
        gmail_connected: false,
        sheets_connected: false,
        google_connected_email: null,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', sprintId)
    .select('*')
    .single();

  if (upErr || !updated) {
    return Response.json({ error: upErr?.message ?? 'Failed to update sprint' }, { status: 500 });
  }

  return Response.json({ ok: true, sprint: updated });
}
