import { processScheduledTouches } from '@/lib/agents/nurture/orchestrator';

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = request.headers.get('authorization');
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const processed = await processScheduledTouches();

    return Response.json({ ok: true, processed, fired_at: new Date().toISOString() });
  } catch (error) {
    console.error('[cron/nurture]', error);
    return Response.json({ error: 'Failed to process nurture touches', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
