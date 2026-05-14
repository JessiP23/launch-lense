// ─────────────────────────────────────────────────────────────────────────────
// GET /api/geo
//
// Returns the requesting user's best-guess country (ISO-2). Used by the
// DeployGate to pre-select a sensible targeting country before the user
// confirms launch.
//
// Resolution order:
//   1. `x-vercel-ip-country` request header (set automatically on Vercel).
//   2. `cf-ipcountry` request header (Cloudflare).
//   3. META_DEFAULT_COUNTRIES env (first entry).
//   4. 'US' as a final fallback.
//
// No auth gate: this only exposes the country code of the *caller's own*
// network, never another user's data, so it's safe to call anonymously.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

const COUNTRY_RX = /^[A-Z]{2}$/;

function pickCountry(req: NextRequest): string {
  const vercel = req.headers.get('x-vercel-ip-country');
  if (vercel && COUNTRY_RX.test(vercel.toUpperCase())) return vercel.toUpperCase();

  const cf = req.headers.get('cf-ipcountry');
  if (cf && COUNTRY_RX.test(cf.toUpperCase())) return cf.toUpperCase();

  const envFirst = (process.env.META_DEFAULT_COUNTRIES ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .find((c) => COUNTRY_RX.test(c));
  if (envFirst) return envFirst;

  return 'US';
}

export async function GET(req: NextRequest) {
  return Response.json({ country: pickCountry(req) });
}
