import type { NextRequest } from 'next/server';

/**
 * Origin for links and non-OAuth server code when no request is available.
 * Prefer NEXT_PUBLIC_APP_URL, then Vercel preview URL, else localhost.
 */
export function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, '')}` : '';
  if (vercel) return vercel;
  return 'http://localhost:3000';
}

/**
 * Origin of the incoming HTTP request — use for Google OAuth redirect_uri and
 * post-callback browser redirects. Matches the host the user actually opened
 * (e.g. localhost) even when NEXT_PUBLIC_APP_URL points at production.
 */
export function requestAppOrigin(req: NextRequest): string {
  return req.nextUrl.origin.replace(/\/$/, '');
}
