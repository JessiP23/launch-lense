// ─────────────────────────────────────────────────────────────────────────────
// POST /api/data-deletion
//
// Self-serve data-deletion REQUEST endpoint (Option 2 on /data-deletion).
// We never delete synchronously here: a public unauthenticated endpoint must
// not be allowed to wipe accounts by guessing emails. Instead we queue a
// pending request in `data_deletion_requests` keyed by a random confirmation
// id; the user then clicks the link in the verification email which hits
// /api/data-deletion/confirm to actually run the cascade.
//
// We always return a confirmation_id even when no matching account exists, to
// avoid leaking which emails are registered.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { randomUUID, randomBytes } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase';

const RequestSchema = z.object({
  email: z.string().email().max(320),
  reason: z.string().max(500).optional(),
});

function newConfirmationId(): string {
  return `del_${randomBytes(12).toString('hex')}`;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input' }, { status: 400 });
  }
  const { email, reason } = parsed.data;

  const db = createServiceClient();
  const confirmationId = newConfirmationId();
  const verificationToken = randomUUID();

  // Persist the request — the verification email is sent separately by a
  // background worker / transactional email provider. Failure to insert
  // should still return a generic ack to avoid email-enumeration.
  const { error } = await db.from('data_deletion_requests').insert({
    confirmation_id: confirmationId,
    email,
    reason: reason ?? null,
    verification_token: verificationToken,
    source: 'self_serve',
    status: 'pending_verification',
    requested_ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    requested_user_agent: req.headers.get('user-agent') ?? null,
  });

  if (error) {
    console.error('[data-deletion] insert failed:', error.message);
    // Still return a successful-looking response so we don't leak which
    // emails exist. Operators will see the error in logs.
  }

  return Response.json({ confirmation_id: confirmationId });
}
