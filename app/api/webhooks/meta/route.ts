import { NextRequest } from 'next/server';

// Meta webhook handler
// Subscribe to ad_account status changes
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Verify webhook signature in production
  // const signature = request.headers.get('x-hub-signature-256');

  try {
    const { entry } = body;

    if (!entry) {
      return Response.json({ received: true });
    }

    for (const e of entry) {
      const changes = e.changes || [];
      for (const change of changes) {
        if (change.field === 'account_status') {
          const accountId = e.id;
          const newStatus = change.value?.account_status;

          if (newStatus !== 'ACTIVE') {
            // TODO: Pause all tests for this ad_account_id within 60s
            console.log(
              `[WEBHOOK] Account ${accountId} status changed to ${newStatus}. Pausing all tests.`
            );
          }
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Meta webhook verification
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'launchlense_verify';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return Response.json({ error: 'Verification failed' }, { status: 403 });
}
