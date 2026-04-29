/**
 * SlackAgent — formats sprint summary as plain text (Block Kit optional later).
 */

import type { OutreachAgentOutput, SlackAgentOutput, SprintRecord } from '@/lib/agents/types';

function fmtSpend(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function formatSlackSprintSummary(
  sprint: SprintRecord,
  outreach?: OutreachAgentOutput | null,
): string {
  const v = sprint.verdict?.verdict ?? 'PENDING';
  const channels = sprint.verdict?.per_channel ?? [];
  const winning = sprint.verdict?.cross_channel_winning_angle ?? '—';
  const wm = sprint.verdict?.aggregate_metrics;
  const ctrPct =
    wm && wm.weighted_blended_ctr != null ? `${(wm.weighted_blended_ctr * 100).toFixed(2)}%` : '—';

  const lines = [
    `LaunchLense · Sprint Complete · sprint_${sprint.sprint_id.slice(0, 8)}`,
    '',
    `Verdict: ${v}`,
    `Idea: ${sprint.idea}`,
    '',
    'Channel Results:',
    ...channels.map(
      (ch) =>
        `  ${ch.channel.padEnd(10)} → ${ch.verdict.padEnd(8)} · ${(ch.blended_ctr * 100).toFixed(1)}% CTR · ${fmtSpend(ch.total_spend_cents)} spent`,
    ),
    '',
    `Winning angle: ${winning}`,
    `Weighted CTR: ${ctrPct} across ${wm ? fmtSpend(wm.total_spend_cents) : '$—'} total spend`,
    '',
  ];

  if (v === 'NO-GO') {
    lines.push('No outreach sent. Pivot brief attached in report.');
  }

  if (outreach && outreach.totalSent > 0) {
    lines.push(`Outreach: ${outreach.totalSent} emails via Gmail · "${outreach.subjectLine}"`);
  }

  lines.push('', `Download report: /api/reports/${sprint.sprint_id}`);

  return lines.join('\n');
}

export function slackSkippedNote(reason: string): SlackAgentOutput {
  return {
    posted: false,
    skippedReason: reason,
    channel: null,
    messagePreview: '',
    postedAt: null,
  };
}
