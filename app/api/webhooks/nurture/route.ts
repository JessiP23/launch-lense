import { handleBehaviorWebhook } from '@/lib/agents/nurture/orchestrator';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.event_type) {
      return Response.json({ error: 'event_type is required', code: 'INVALID_INPUT' }, { status: 400 });
    }

    if (!body.lead_id && !body.email) {
      return Response.json({ error: 'Either lead_id or email is required', code: 'INVALID_INPUT' }, { status: 400 });
    }

    await handleBehaviorWebhook(body);

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[webhooks/nurture]', error);
    return Response.json({ error: 'Failed to handle webhook', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
