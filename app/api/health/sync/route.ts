export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { calculateHealthChecks } from '@/lib/healthgate';
import { fetchAdAccountHealth } from '@/lib/meta-api';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const accountId = searchParams.get('account_id') || searchParams.get('ad_account_id');

  if (!accountId) {
    return Response.json(
      { error: 'Missing account_id parameter' },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch ad account row from DB
    const { data: account, error: accountError } = await supabaseAdmin
      .from('ad_accounts')
      .select('id, account_id, access_token, org_id, name')
      .eq('account_id', accountId)
      .single();

    if (accountError || !account) {
      return Response.json(
        { error: `Ad account ${accountId} not found in database` },
        { status: 404 }
      );
    }

    // 2. Resolve the token (may be raw EAA... or a vault reference)
    let accessToken = account.access_token;
    if (!accessToken) {
      return Response.json({ error: 'No access token for this account' }, { status: 400 });
    }

    // If it's a vault reference (not starting with EAA), try to look up
    if (!accessToken.startsWith('EAA')) {
      // Fall back to env var if available
      accessToken = process.env.AD_ACCESS_TOKEN || accessToken;
    }

    // 3. Call Meta API for real account health
    const rawId = accountId.replace('act_', '');
    const rawData = await fetchAdAccountHealth(rawId, accessToken);

    // 4. Calculate health checks
    const { checks, score, status } = calculateHealthChecks(rawData as Record<string, unknown>);

    // 5. Insert health snapshot
    const { data: snapshot, error: snapshotError } = await supabaseAdmin
      .from('health_snapshots')
      .insert({
        ad_account_id: account.id,
        score,
        status,
        checks,
      })
      .select()
      .single();

    if (snapshotError) {
      console.error('[health/sync] Snapshot insert error:', snapshotError);
    }

    // 6. Update last_checked_at
    await supabaseAdmin
      .from('ad_accounts')
      .update({ last_checked_at: new Date().toISOString() })
      .eq('id', account.id);

    const result = {
      id: snapshot?.id || `snapshot-${Date.now()}`,
      ad_account_id: account.id,
      score,
      status,
      checks,
      created_at: snapshot?.created_at || new Date().toISOString(),
    };

    return Response.json({
      snapshot: result,
      accountId: account.account_id,
      accountName: account.name,
    });
  } catch (error) {
    console.error('[health/sync] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to sync health data';
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { account_id } = body;

  if (!account_id) {
    return Response.json({ error: 'Missing account_id' }, { status: 400 });
  }

  // Redirect to GET logic via internal fetch
  const url = new URL(request.url);
  url.searchParams.set('account_id', account_id);
  const res = await fetch(url.toString());
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
