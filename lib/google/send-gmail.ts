/** Gmail API raw send — plain UTF-8 body (ASCII-safe subjects recommended). */
export async function sendGmailPlain(params: {
  accessToken: string;
  fromEmail: string;
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const lines = [
    `From: ${params.fromEmail}`,
    `To: ${params.to}`,
    `Subject: ${params.subject.replace(/\r?\n/g, ' ')}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    params.body.replace(/\r/g, ''),
  ];
  const raw = lines.join('\r\n');
  const encoded = Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Gmail API ${res.status}`);
  }
}
