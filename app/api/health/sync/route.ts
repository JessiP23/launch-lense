import { NextRequest } from 'next/server';
import { calculateHealthChecks, getDemoAccountData } from '@/lib/healthgate';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const isDemo = searchParams.get('demo') === '1';
  const mode = (searchParams.get('mode') as 'red' | 'green') || 'red';

  if (isDemo) {
    // Demo mode: return mock health data
    const accountData = getDemoAccountData(mode);
    const { checks, score, status } = calculateHealthChecks(accountData);

    const snapshot = {
      id: `demo-snapshot-${Date.now()}`,
      ad_account_id: 'demo-account',
      score,
      status,
      checks,
      created_at: new Date().toISOString(),
    };

    return Response.json({
      snapshot,
      accountId: 'demo-account',
      demo: true,
    });
  }

  // Production mode: fetch from Meta API
  const accountId = searchParams.get('account_id');
  if (!accountId) {
    return Response.json(
      { error: 'Missing account_id parameter' },
      { status: 400 }
    );
  }

  try {
    // In production, we'd:
    // 1. Get access_token from Vault
    // 2. Call Meta API for account health fields
    // 3. Calculate checks
    // 4. Insert into health_snapshots table
    // 5. Update ad_accounts.last_checked_at

    return Response.json({
      error: 'Production mode not yet configured. Set ADS_API_MODE=sandbox and use ?demo=1',
    }, { status: 501 });
  } catch (error) {
    return Response.json(
      { error: 'Failed to sync health data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Webhook-triggered health sync
  const body = await request.json();
  const { account_id } = body;

  if (!account_id) {
    return Response.json({ error: 'Missing account_id' }, { status: 400 });
  }

  // Same flow as GET production mode
  return Response.json({ message: 'Health sync triggered', account_id });
}
