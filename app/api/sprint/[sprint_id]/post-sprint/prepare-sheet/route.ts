export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import type { SprintRecord } from '@/lib/agents/types';
import { runSpreadsheetAgent } from '@/lib/agents/spreadsheet-agent';
import { oauthScopeKeyFromSprint } from '@/lib/google/sprint-scope';
import { getGoogleRefreshToken } from '@/lib/google/token-store';
import { refreshAccessToken } from '@/lib/google/oauth-http';
import { extractSpreadsheetId, fetchSheetRowsAsRecords } from '@/lib/google/fetch-sheet';

type DbRow = Record<string, unknown>;

function asSprint(row: DbRow): SprintRecord {
  const id = (row.id as string) ?? (row.sprint_id as string);
  return {
    ...(row as unknown as SprintRecord),
    sprint_id: (row.sprint_id as string) ?? id,
  };
}

/** Persist aggregate stats only — never raw contact rows. */
function spreadsheetPersistPayload(result: ReturnType<typeof runSpreadsheetAgent>) {
  const { contacts, ...rest } = result;
  void contacts;
  return {
    ...rest,
    contacts: [] as [],
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> },
) {
  const { sprint_id } = await params;
  const db = createServiceClient();

  const body = (await req.json().catch(() => ({}))) as {
    rows?: Record<string, string>[];
    sheetName?: string;
    icp_filter?: boolean;
    live_google_sheet?: boolean;
    google_sheet_input?: string;
  };

  const { data: raw, error } = await db.from('sprints').select('*').eq('id', sprint_id).single();
  if (error || !raw) return Response.json({ error: 'Sprint not found' }, { status: 404 });

  const sprint = asSprint(raw as DbRow);
  if (sprint.state !== 'COMPLETE') {
    return Response.json({ error: 'SpreadsheetAgent runs only after sprint COMPLETE' }, { status: 409 });
  }

  const verdict = sprint.verdict?.verdict;
  if (verdict !== 'GO' && verdict !== 'ITERATE') {
    return Response.json(
      { error: 'SpreadsheetAgent activates only when aggregate verdict is GO or ITERATE' },
      { status: 409 },
    );
  }

  const integrations = sprint.integrations ?? {};

  let rows: Record<string, string>[] = Array.isArray(body.rows) ? body.rows : [];
  let resolvedSheetName = body.sheetName ?? integrations.google_sheet_name ?? 'Contacts';

  if (body.live_google_sheet) {
    const scopeKey = oauthScopeKeyFromSprint({
      id: raw.id as string,
      org_id: (raw.org_id as string | null) ?? null,
    });
    const rt = await getGoogleRefreshToken(scopeKey);
    if (!rt) {
      return Response.json({ error: 'Google not connected — authorize Sheets + Gmail first.' }, { status: 401 });
    }

    const sid =
      extractSpreadsheetId(body.google_sheet_input ?? '') ??
      extractSpreadsheetId((integrations.google_sheet_url as string | undefined) ?? '') ??
      extractSpreadsheetId((integrations.google_sheet_id as string | undefined) ?? '') ??
      null;

    if (!sid) {
      return Response.json(
        { error: 'Provide a spreadsheet URL or ID (integrations.google_sheet_url / google_sheet_id).' },
        { status: 400 },
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return Response.json({ error: 'Google OAuth client not configured on server.' }, { status: 503 });
    }

    const { access_token } = await refreshAccessToken({
      refreshToken: rt,
      clientId,
      clientSecret,
    });

    const fetched = await fetchSheetRowsAsRecords(access_token, sid);
    rows = fetched.rows;
    resolvedSheetName = fetched.sheetTitle;
  }

  if (!rows.length) {
    return Response.json(
      { error: 'No rows — paste CSV below or connect Google and pull a live sheet.' },
      { status: 400 },
    );
  }

  const result = runSpreadsheetAgent({
    sheetName: resolvedSheetName,
    rows,
    icpFilter: body.icp_filter,
    genome: sprint.genome ?? null,
  });

  const persist = spreadsheetPersistPayload(result);
  const post_sprint = {
    phase: 'spreadsheet_done' as const,
    spreadsheet: persist,
    warnings: [...(result.warnings ?? [])],
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error: upErr } = await db
    .from('sprints')
    .update({
      post_sprint,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sprint_id)
    .select('*')
    .single();

  if (upErr || !updated) {
    return Response.json({ error: upErr?.message ?? 'Failed to save spreadsheet summary' }, { status: 500 });
  }

  await db.from('sprint_events').insert({
    sprint_id,
    agent: 'spreadsheet',
    event_type: 'completed',
    payload: {
      validContacts: result.validContacts,
      totalRows: result.totalRows,
      skippedInvalidEmail: result.skippedInvalidEmail,
      skippedNoEmail: result.skippedNoEmail,
      filteredCount: result.filteredCount,
      icpFilterApplied: result.icpFilterApplied,
      live_sheet: Boolean(body.live_google_sheet),
      sheetTitle: resolvedSheetName,
      warnings: result.warnings ?? [],
    },
  });

  return Response.json({
    spreadsheet: result,
    sprint: updated,
  });
}
