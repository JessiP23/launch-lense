import { runAutopilotCycle } from '@/lib/autopilot/engine';

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = request.headers.get('authorization');
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fire and return — do not await
  void runAutopilotCycle().catch(err => console.error('[autopilot-cron]', err));

  return Response.json({ ok: true, fired_at: new Date().toISOString() });
}
