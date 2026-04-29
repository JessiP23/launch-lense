/** Canonical origin for OAuth redirects — set NEXT_PUBLIC_APP_URL in env */
export function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, '')}` : '';
  if (vercel) return vercel;
  return 'http://localhost:3000';
}
