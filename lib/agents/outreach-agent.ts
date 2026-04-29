/**
 * OutreachAgent — builds plain-text 1:1 emails from the winning angle.
 * Production sending uses Gmail API with OAuth; this module validates and shapes payloads.
 */

import type {
  Angle,
  OutreachAgentOutput,
  SprintRecord,
  SpreadsheetContactRow,
} from '@/lib/agents/types';

export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  const user = email.slice(0, at);
  const domain = email.slice(at + 1);
  const safe = user.length <= 2 ? '*' : `${user.slice(0, 1)}***`;
  return `${safe}@${domain}`;
}

function winningAngle(sprint: SprintRecord): Angle | null {
  const id = sprint.verdict?.cross_channel_winning_angle;
  const angles = sprint.angles?.angles;
  if (!angles?.length) return null;
  if (id) {
    const found = angles.find((a) => a.id === id);
    if (found) return found;
  }
  return angles[0];
}

function landingUrlForSprint(sprint: SprintRecord): string | null {
  const pages = sprint.landing?.pages;
  const utm = pages?.[0]?.utm_base;
  if (utm && /^https?:\/\//i.test(utm)) return utm;
  if (sprint.sprint_id) return `https://launchlense.app/lp/${sprint.sprint_id}`;
  return null;
}

export function buildOutreachCopy(sprint: SprintRecord): {
  subjectLine: string;
  baseBody: string;
  angleUsed: 'angle_A' | 'angle_B' | 'angle_C';
} | null {
  const angle = winningAngle(sprint);
  if (!angle) return null;
  const baseUrl = landingUrlForSprint(sprint) ?? 'https://example.com';
  const utm = `${baseUrl.includes('?') ? '&' : '?'}utm_source=email&utm_medium=outreach&utm_campaign=${encodeURIComponent(sprint.sprint_id)}`;
  const link = `${baseUrl}${utm}`;
  const subjectLine = angle.copy.meta.headline.slice(0, 200);
  const baseBody = [
    'Hi [firstName],',
    '',
    angle.copy.meta.body,
    '',
    link,
    '',
    sprint.genome?.proceed_note ? `Note: ${sprint.genome.proceed_note}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .replace(/\s+\n/g, '\n');

  return { subjectLine, baseBody, angleUsed: angle.id };
}

function personalize(body: string, c: SpreadsheetContactRow): string {
  const first = c.firstName?.trim() || 'there';
  return body
    .replace(/\[firstName\]/gi, first)
    .replace(/\[company\]/gi, c.company?.trim() || 'your team');
}

/** Subject + personalized plain body for Gmail API sends */
export function personalizeCopyBody(
  sprint: SprintRecord,
  contact: SpreadsheetContactRow,
): {
  subjectLine: string;
  body: string;
  angleUsed: 'angle_A' | 'angle_B' | 'angle_C';
} | null {
  const copy = buildOutreachCopy(sprint);
  if (!copy) return null;
  return {
    subjectLine: copy.subjectLine,
    body: personalize(copy.baseBody, contact),
    angleUsed: copy.angleUsed,
  };
}

export interface SimulateOutreachOptions {
  /** Cap per request for demo safety */
  maxSimulated?: number;
}

export function simulateOutreachBatch(
  sprint: SprintRecord,
  contacts: SpreadsheetContactRow[],
  options?: SimulateOutreachOptions,
): OutreachAgentOutput {
  const copy = buildOutreachCopy(sprint);
  if (!copy) {
    throw new Error('Cannot build outreach — angles or verdict missing.');
  }

  const verdict = sprint.verdict?.verdict;
  if (verdict === 'NO-GO') {
    throw new Error('Outreach blocked — aggregate verdict is NO-GO.');
  }

  const max = Math.min(contacts.length, options?.maxSimulated ?? 500);
  const batch = contacts.slice(0, max);

  const ts = new Date().toISOString();
  const sendLog = batch.map((c) => ({
    email: maskEmail(c.email),
    status: 'sent' as const,
    timestamp: ts,
  }));

  const sampleBody =
    batch.length > 0 ? personalize(copy.baseBody, batch[0]) : copy.baseBody;

  return {
    totalSent: batch.length,
    failed: 0,
    bounced: 0,
    subjectLine: copy.subjectLine,
    angleUsed: copy.angleUsed,
    sendLog,
    sprintId: sprint.sprint_id,
    bodyPreview: sampleBody.slice(0, 480),
  };
}
