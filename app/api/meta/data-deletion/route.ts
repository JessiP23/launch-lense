// ─────────────────────────────────────────────────────────────────────────────
// POST /api/meta/data-deletion
//
// Meta App Review "Data Deletion Request Callback URL".
//
// Meta sends an application/x-www-form-urlencoded POST with a single
// `signed_request` field. We:
//   1. Verify the HMAC-SHA256 signature using META_APP_SECRET.
//   2. Decode the JSON payload to extract the platform `user_id`.
//   3. Look up the LaunchLense account linked to that Meta user (if any).
//   4. Queue a deletion request (status page is polled by Meta).
//   5. Return { url, confirmation_code } per Meta's required schema.
//
// We never reveal whether a user actually exists in our database — the
// confirmation code is always returned. The polling URL responds with the
// real status only once the cascade is verified.
//
// Reference:
// https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase';

function base64urlDecode(s: string): Buffer {
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

interface MetaSignedRequestPayload {
  algorithm: string;
  issued_at: number;
  user_id: string;
}

/**
 * Verify Meta's HMAC-SHA256-signed payload.
 * Returns the decoded JSON, or null on any verification failure.
 */
function parseSignedRequest(
  signedRequest: string,
  appSecret: string
): MetaSignedRequestPayload | null {
  const parts = signedRequest.split('.');
  if (parts.length !== 2) return null;
  const [encodedSig, encodedPayload] = parts;

  let sigBuf: Buffer;
  let payload: MetaSignedRequestPayload;
  try {
    sigBuf = base64urlDecode(encodedSig);
    payload = JSON.parse(
      base64urlDecode(encodedPayload).toString('utf-8')
    ) as MetaSignedRequestPayload;
  } catch {
    return null;
  }

  if (payload.algorithm !== 'HMAC-SHA256') return null;

  const expected = createHmac('sha256', appSecret).update(encodedPayload).digest();
  if (expected.length !== sigBuf.length) return null;
  try {
    if (!timingSafeEqual(expected, sigBuf)) return null;
  } catch {
    return null;
  }
  return payload;
}

function newConfirmationCode(): string {
  return `meta_del_${randomBytes(12).toString('hex')}`;
}

function statusUrl(confirmationCode: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BASE_URL ??
    'https://launchlense.com';
  return `${base}/data-deletion/status/${confirmationCode}`;
}

export async function POST(req: NextRequest) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error('[meta-data-deletion] META_APP_SECRET missing');
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // Meta sends form-encoded body.
  const form = await req.formData();
  const signedRequest = form.get('signed_request');
  if (typeof signedRequest !== 'string' || !signedRequest) {
    return Response.json({ error: 'Missing signed_request' }, { status: 400 });
  }

  const payload = parseSignedRequest(signedRequest, appSecret);
  if (!payload) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const confirmationCode = newConfirmationCode();
  const db = createServiceClient();

  // Queue the deletion. The cascade runs in a background worker so we can
  // return Meta's required envelope within the platform timeout.
  const { error } = await db.from('data_deletion_requests').insert({
    confirmation_id: confirmationCode,
    email: null,
    reason: 'meta_initiated',
    source: 'meta_callback',
    meta_user_id: payload.user_id,
    status: 'pending_cascade',
    requested_ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    requested_user_agent: req.headers.get('user-agent') ?? null,
  });

  if (error) {
    console.error('[meta-data-deletion] queue insert failed:', error.message);
    // Per Meta's docs we should still return a 200 with a valid envelope
    // when possible; otherwise Meta will retry. We return 500 so they retry.
    return Response.json({ error: 'Queueing failed' }, { status: 500 });
  }

  return Response.json({
    url: statusUrl(confirmationCode),
    confirmation_code: confirmationCode,
  });
}

// Meta sometimes pings the endpoint with GET for liveness checks.
export async function GET() {
  return Response.json({
    service: 'launchlense_data_deletion',
    method: 'POST',
    docs: 'https://launchlense.com/data-deletion',
  });
}
