export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import type { OutreachAgentOutput, SpreadsheetContactRow, SprintRecord } from '@/lib/agents/types';
import {
  maskEmail,
  personalizeCopyBody,
} from '@/lib/agents/outreach-agent';
import { oauthScopeKeyFromSprint } from '@/lib/google/sprint-scope';
import { getGoogleConnection, getGoogleRefreshToken } from '@/lib/google/token-store';
import { refreshAccessToken } from '@/lib/google/oauth-http';
import { sendGmailPlain } from '@/lib/google/send-gmail';
import { fetchGoogleUserEmail } from '@/lib/google/userinfo';
import { delay } from '@/lib/utils/delay';

type DbRow = Record<string, unknown>;

function asSprint(row: DbRow): SprintRecord {
  const id = (row.id as string) ?? (row.sprint_id as string);
  return {
    ...(row as unknown as SprintRecord),
    sprint_id: (row.sprint_id as string) ?? id,
  };
}

/** Gap between Gmail sends — default ~72s (~50/hour); override with GOOGLE_SEND_INTERVAL_MS (ms). */
function sendGapMs(): number {
  const n = Number.parseInt(process.env.GOOGLE_SEND_INTERVAL_MS ?? '', 10);
  if (Number.isFinite(n) && n >= 0) return n;
  return Math.ceil(3_600_000 / 50);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> },
) {
  const { sprint_id } = await params;
  const db = createServiceClient();

  const body = (await req.json().catch(() => ({}))) as {
    contacts?: SpreadsheetContactRow[];
    confirm_large_batch?: boolean;
  };

  const { data: raw, error } = await db.from('sprints').select('*').eq('id', sprint_id).single();
  if (error || !raw) return Response.json({ error: 'Sprint not found' }, { status: 404 });

  const sprint = asSprint(raw as DbRow);
  const verdict = sprint.verdict?.verdict;
  if (!verdict) {
    return Response.json({ error: 'Outreach waits for an aggregate verdict before sending.' }, { status: 409 });
  }
  if (verdict === 'NO-GO') {
    return Response.json({ error: 'Hard block — aggregate verdict is NO-GO' }, { status: 403 });
  }
  if (verdict !== 'GO' && verdict !== 'ITERATE') {
    return Response.json({ error: 'Outreach runs only when aggregate verdict is GO or ITERATE' }, { status: 409 });
  }

  const contacts = Array.isArray(body.contacts) ? body.contacts : [];
  if (!contacts.length) {
    return Response.json({ error: 'Provide contacts[] (same payload returned from prepare-sheet).' }, { status: 400 });
  }

  if (contacts.length > 2000 && !body.confirm_large_batch) {
    return Response.json(
      { error: 'Large send — pass confirm_large_batch: true to acknowledge.', needsConfirm: true },
      { status: 409 },
    );
  }

  const scopeKey = oauthScopeKeyFromSprint({
    id: raw.id as string,
    org_id: (raw.org_id as string | null) ?? null,
  });

  const rt = await getGoogleRefreshToken(scopeKey);
  const conn = await getGoogleConnection(scopeKey);
  const sendDisabled = process.env.GOOGLE_SEND_DISABLED === '1';
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  let outreach: OutreachAgentOutput | null = null;

  if (!rt) {
    return Response.json({ error: 'Google not connected — authorize Gmail before sending outreach.' }, { status: 401 });
  }
  if (!clientId || !clientSecret) {
    return Response.json({ error: 'Google OAuth client is not configured on the server.' }, { status: 503 });
  }
  if (sendDisabled) {
    return Response.json({ error: 'Gmail sending is disabled on this deployment (GOOGLE_SEND_DISABLED=1).' }, { status: 503 });
  }

  if (rt && clientId && clientSecret && !sendDisabled) {
    let fromEmail = conn?.google_email ?? null;
    let accessToken = (await refreshAccessToken({ refreshToken: rt, clientId, clientSecret })).access_token;
    if (!fromEmail) {
      try {
        fromEmail = await fetchGoogleUserEmail(accessToken);
      } catch {
        fromEmail = null;
      }
    }

    if (!fromEmail) {
      return Response.json({ error: 'Gmail sender email unavailable — reconnect Google before sending.' }, { status: 401 });
    } else {
      const envCap = Number.parseInt(process.env.GOOGLE_SEND_MAX ?? '', 10);
      const maxSend = Number.isFinite(envCap) && envCap > 0 ? Math.min(contacts.length, envCap) : contacts.length;

      const sendLog: OutreachAgentOutput['sendLog'] = [];
      let ok = 0;
      let failed = 0;
      let angleUsed: OutreachAgentOutput['angleUsed'] = 'angle_A';
      let subjectLine = '';

      const refreshAccess = async () => {
        const t = await refreshAccessToken({ refreshToken: rt, clientId, clientSecret });
        accessToken = t.access_token;
      };

      for (let i = 0; i < maxSend; i++) {
        const c = contacts[i];
        const ts = new Date().toISOString();
        const pc = personalizeCopyBody(sprint, c);
        if (!pc) {
          failed++;
          sendLog.push({ email: maskEmail(c.email), status: 'failed', timestamp: ts });
          continue;
        }
        if (!subjectLine) {
          subjectLine = pc.subjectLine;
          angleUsed = pc.angleUsed;
        }

        try {
          await sendGmailPlain({
            accessToken,
            fromEmail,
            to: c.email,
            subject: pc.subjectLine,
            body: pc.body,
          });
          ok++;
          sendLog.push({ email: maskEmail(c.email), status: 'sent', timestamp: ts });
        } catch (e) {
          const msg = e instanceof Error ? e.message : '';
          const unauthorized = msg.includes('401') || msg.includes('Invalid Credentials');
          if (unauthorized) {
            try {
              await refreshAccess();
              await sendGmailPlain({
                accessToken,
                fromEmail,
                to: c.email,
                subject: pc.subjectLine,
                body: pc.body,
              });
              ok++;
              sendLog.push({ email: maskEmail(c.email), status: 'sent', timestamp: ts });
            } catch {
              failed++;
              sendLog.push({ email: maskEmail(c.email), status: 'failed', timestamp: ts });
            }
          } else {
            failed++;
            sendLog.push({ email: maskEmail(c.email), status: 'failed', timestamp: ts });
          }
        }

        if (i + 1 < maxSend) {
          await delay(sendGapMs());
        }
      }

      const sample = personalizeCopyBody(sprint, contacts[0]);

      outreach = {
        totalSent: ok,
        failed,
        bounced: 0,
        subjectLine: subjectLine || sample?.subjectLine || '',
        angleUsed,
        sendLog,
        sprintId: sprint.sprint_id,
        bodyPreview: sample?.body.slice(0, 480),
      };
    }
  }

  if (!outreach) {
    return Response.json({ error: 'Outreach could not be built from the selected contacts and winning angle.' }, { status: 500 });
  }

  const post_sprint = {
    ...(sprint.post_sprint ?? { phase: 'idle' }),
    phase: 'outreach_done' as const,
    outreach,
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
    return Response.json({ error: upErr?.message ?? 'Failed to save outreach summary' }, { status: 500 });
  }

  await db.from('sprint_events').insert({
    sprint_id,
    agent: 'outreach',
    event_type: 'completed',
    payload: { totalSent: outreach.totalSent, failed: outreach.failed },
  });

  return Response.json({ outreach, sprint: updated });
}
