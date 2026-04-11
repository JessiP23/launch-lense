import { NextRequest } from 'next/server';

// Cron: Health check every 15 minutes
// Configured via vercel.json: { "crons": [{ "path": "/api/cron/health", "schedule": "*/15 * * * *" }] }
export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  try {
    // In production:
    // 1. Fetch all ad_accounts
    // 2. For each, call /api/health/sync
    // 3. Log results

    return Response.json({
      message: 'Health cron executed',
      accounts_checked: 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: 'Health cron failed' }, { status: 500 });
  }
}
