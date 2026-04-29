export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import type { SlackAgentOutput, SprintRecord } from '@/lib/agents/types';
import { formatSlackSprintSummary, slackSkippedNote } from '@/lib/agents/slack-agent';

type DbRow = Record<string, unknown>;

function asSprint(row: DbRow): SprintRecord {
  const id = (row.id as string) ?? (row.sprint_id as string);
  return {
    ...(row as unknown as SprintRecord),
    sprint_id: (row.sprint_id as string) ?? id,
  };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> },
) {
  const { sprint_id } = await params;
  const db = createServiceClient();

  const { data: raw, error } = await db.from('sprints').select('*').eq('id', sprint_id).single();
  if (error || !raw) return Response.json({ error: 'Sprint not found' }, { status: 404 });

  const sprint = asSprint(raw as DbRow);
  if (sprint.state !== 'COMPLETE') {
    return Response.json({ error: 'Slack summary posts after sprint COMPLETE' }, { status: 409 });
  }

  const outreach = sprint.post_sprint?.outreach ?? null;
  const messagePreview = formatSlackSprintSummary(sprint, outreach);

  let slack: SlackAgentOutput;
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = sprint.integrations?.slack_channel ?? process.env.SLACK_DEFAULT_CHANNEL ?? '#general';

  if (!sprint.integrations?.slack_connected || !token) {
    slack = slackSkippedNote('Slack OAuth not configured — summary prepared locally only.');
    slack.messagePreview = messagePreview;
  } else {
    try {
      const r = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          channel,
          text: messagePreview,
          mrkdwn: false,
        }),
      });
      const json = (await r.json()) as { ok?: boolean; error?: string };
      if (!json.ok) {
        slack = slackSkippedNote(json.error ?? 'Slack API error');
        slack.messagePreview = messagePreview;
      } else {
        slack = {
          posted: true,
          channel,
          messagePreview,
          postedAt: new Date().toISOString(),
        };
      }
    } catch {
      slack = slackSkippedNote('Network error calling Slack API');
      slack.messagePreview = messagePreview;
    }
  }

  const post_sprint = {
    ...(sprint.post_sprint ?? { phase: 'idle' }),
    phase: 'complete' as const,
    slack,
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
    return Response.json({ error: upErr?.message ?? 'Failed to save Slack summary' }, { status: 500 });
  }

  await db.from('sprint_events').insert({
    sprint_id,
    agent: 'slack',
    event_type: slack.posted ? 'completed' : 'skipped',
    payload: { posted: slack.posted },
  });

  return Response.json({ slack, sprint: updated });
}
