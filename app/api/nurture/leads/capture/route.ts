import { captureInboundLead } from '@/lib/agents/nurture/lead-capture';
import type { LeadCaptureInput } from '@/lib/agents/nurture/lead-capture';

export async function POST(request: Request) {
  try {
    const body: LeadCaptureInput = await request.json();

    // Validate required fields
    if (!body.email) {
      return Response.json({ error: 'Email is required', code: 'INVALID_INPUT' }, { status: 400 });
    }

    if (!body.source || !['webhook', 'manual', 'campaign'].includes(body.source)) {
      return Response.json({ error: 'Source must be one of: webhook, manual, campaign', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const result = await captureInboundLead(body);

    return Response.json(result);
  } catch (error) {
    console.error('[nurture/leads/capture]', error);
    return Response.json({ error: 'Failed to capture lead', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
