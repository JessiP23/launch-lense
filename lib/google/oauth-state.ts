import { createHmac, timingSafeEqual } from 'crypto';

export type OAuthStatePayload = {
  sprint_id: string;
  scope_key: string;
  ts: number;
};

const MAX_AGE_MS = 15 * 60 * 1000;

export function signOAuthState(payload: OAuthStatePayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyOAuthState(token: string, secret: string): OAuthStatePayload | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  try {
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let parsed: OAuthStatePayload;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthStatePayload;
  } catch {
    return null;
  }
  if (!parsed.sprint_id || !parsed.scope_key || typeof parsed.ts !== 'number') return null;
  if (Date.now() - parsed.ts > MAX_AGE_MS) return null;
  return parsed;
}
