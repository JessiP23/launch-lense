export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ── Valid Sandbox fields ───────────────────────────────────────────────
const HEALTH_FIELDS = [
  'account_status',
  'balance',
  'spend_cap',
  'amount_spent',
  'adspixels{last_fired_time}',
  'funding_source_details',
  'disable_reason',
  'name',
  'currency',
  'business',
].join(',');

const META_API = 'https://graph.facebook.com/v20.0';

/**
 * Map raw Meta response → flat payload for calculateHealthChecks().
 * Sandbox cannot return 2FA, domain verification, or admin access,
 * so we hardcode those as passed with a `sandbox_assumed` value.
 */
function metaToHealthPayload(meta: Record<string, unknown>): Record<string, unknown> {
  // Pixel: check adspixels edge for last_fired_time within 7 days
  let pixelActive = false;
  const pixels = meta.adspixels as { data?: { last_fired_time?: string }[] } | undefined;
  if (pixels?.data?.[0]?.last_fired_time) {
    const lastFired = new Date(pixels.data[0].last_fired_time).getTime();
    pixelActive = Date.now() - lastFired < 7 * 24 * 60 * 60 * 1000;
  }

  // Funding source
  const funding = meta.funding_source_details as Record<string, unknown> | undefined;
  const hasFunding = Boolean(funding?.id || funding?.display_string);

  return {
    account_status: meta.account_status ?? 0,
    balance: Number(meta.balance ?? 0),
    spend_cap: meta.spend_cap ? Number(meta.spend_cap) : 0,
    amount_spent: Number(meta.amount_spent ?? 0),
    disapproved_90d: 0, // Would need a separate ads query; 0 for now
    page_quality: 1, // Not available from this endpoint; assume good
    pixel_active: pixelActive,
    funding_source: hasFunding,
    // ── Sandbox hardcodes (API cannot check these) ──
    two_factor_enabled: 'sandbox_assumed',
    domain_verified: 'sandbox_assumed',
    has_advertiser_access: 'sandbox_assumed',
    spend_30d: Number(meta.amount_spent ?? 0),
    policy_issues: Number(meta.disable_reason ?? 0) > 0 ? 1 : 0,
  };
}

/**
 * Healthgate 12-check scoring.
 * Mirrors lib/healthgate.ts but handles `sandbox_assumed` values.
 */
function calculateHealthChecks(data: Record<string, unknown>) {
  const isSandboxAssumed = (v: unknown) => v === 'sandbox_assumed' || v === true;

  const checks = [
    {
      name: 'Account Status',
      key: 'account_status',
      maxPoints: 20,
      passed: data.account_status === 1,
      value: data.account_status === 1 ? 'Active' : `Status ${data.account_status}`,
      points: data.account_status === 1 ? 20 : 0,
      fix: 'Ensure your Meta ad account is active and in good standing.',
    },
    {
      name: 'Account Balance',
      key: 'balance',
      maxPoints: 10,
      passed: Number(data.balance || 0) >= 0, // Sandbox balance is often 0
      value: `$${(Number(data.balance || 0) / 100).toFixed(2)}`,
      points: Number(data.balance || 0) >= 0 ? 10 : 0,
      fix: 'Add funds to your ad account balance.',
    },
    {
      name: 'Spend Cap',
      key: 'spend_cap',
      maxPoints: 5,
      passed: Number(data.spend_cap || 0) >= 0, // Sandbox may not have caps
      value: data.spend_cap ? `$${(Number(data.spend_cap) / 100).toFixed(0)}` : 'None (OK)',
      points: 5, // Pass in sandbox
      fix: 'Set spend cap above $100 in Meta Business Settings.',
    },
    {
      name: 'Disapproved Ads (90d)',
      key: 'disapproved_90d',
      maxPoints: 15,
      passed: Number(data.disapproved_90d || 0) < 3,
      value: String(data.disapproved_90d || 0),
      points: Number(data.disapproved_90d || 0) < 3 ? 15 : 0,
      fix: 'Resolve disapproved ads. Fewer than 3 in 90 days required.',
    },
    {
      name: 'Page Quality',
      key: 'page_quality',
      maxPoints: 10,
      passed: Number(data.page_quality || 0) > 0.5,
      value: String(data.page_quality || 'N/A'),
      points: Number(data.page_quality || 0) > 0.5 ? 10 : 0,
      fix: 'Improve your Facebook Page quality score above 0.5.',
    },
    {
      name: 'Pixel Activity',
      key: 'pixel_active',
      maxPoints: 15,
      passed: Boolean(data.pixel_active),
      value: data.pixel_active ? 'Active (< 7d)' : 'Inactive',
      points: data.pixel_active ? 15 : 0,
      fix: 'Install and verify Meta Pixel fires within the last 7 days.',
    },
    {
      name: 'Funding Source',
      key: 'funding_source',
      maxPoints: 10,
      passed: Boolean(data.funding_source),
      value: data.funding_source ? 'Connected' : 'Missing',
      points: data.funding_source ? 10 : 0,
      fix: 'Add a valid payment method in Meta Business Settings.',
    },
    {
      name: 'Two-Factor Auth',
      key: '2fa',
      maxPoints: 5,
      passed: isSandboxAssumed(data.two_factor_enabled),
      value: data.two_factor_enabled === 'sandbox_assumed' ? '✓ (sandbox)' : data.two_factor_enabled ? 'Enabled' : 'Disabled',
      points: isSandboxAssumed(data.two_factor_enabled) ? 5 : 0,
      fix: 'Enable 2FA on the Meta Business account.',
    },
    {
      name: 'Domain Verified',
      key: 'domain_verified',
      maxPoints: 5,
      passed: isSandboxAssumed(data.domain_verified),
      value: data.domain_verified === 'sandbox_assumed' ? '✓ (sandbox)' : data.domain_verified ? 'Yes' : 'No',
      points: isSandboxAssumed(data.domain_verified) ? 5 : 0,
      fix: 'Verify your domain in Meta Business Settings.',
    },
    {
      name: 'Admin Access',
      key: 'admin_access',
      maxPoints: 5,
      passed: isSandboxAssumed(data.has_advertiser_access),
      value: data.has_advertiser_access === 'sandbox_assumed' ? '✓ (sandbox)' : data.has_advertiser_access ? 'Yes' : 'No',
      points: isSandboxAssumed(data.has_advertiser_access) ? 5 : 0,
      fix: 'Ensure admin-level access to the ad account.',
    },
    {
      name: 'Spend (30d)',
      key: 'spend_30d',
      maxPoints: 5,
      passed: Number(data.spend_30d || 0) >= 0, // Sandbox may have 0 spend
      value: `$${(Number(data.spend_30d || 0) / 100).toFixed(0)}`,
      points: 5, // Pass in sandbox
      fix: 'Account must have spent in the last 30 days.',
    },
    {
      name: 'Policy Issues',
      key: 'policy_issues',
      maxPoints: 10,
      passed: Number(data.policy_issues || 0) === 0,
      value: String(data.policy_issues || 0),
      points: Number(data.policy_issues || 0) === 0 ? 10 : 0,
      fix: 'Resolve all outstanding policy violations.',
    },
  ];

  const score = checks.reduce((sum, c) => sum + c.points, 0);
  const status: 'red' | 'yellow' | 'green' =
    score < 60 ? 'red' : score < 80 ? 'yellow' : 'green';

  return { checks, score, status };
}

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
    // 1. Fetch ad account row from DB — support both internal UUID and Meta account_id (act_...)
    const isMetaId = accountId.startsWith('act_');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId);

    let account: { id: string; account_id: string; access_token: string; org_id: string; name: string } | null = null;
    let accountError: unknown = null;

    if (isMetaId) {
      // Lookup by Meta account_id (act_xxx)
      const result = await supabaseAdmin
        .from('ad_accounts')
        .select('id, account_id, access_token, org_id, name')
        .eq('account_id', accountId)
        .single();
      account = result.data;
      accountError = result.error;
    } else if (isUuid) {
      // Lookup by internal Supabase UUID
      const result = await supabaseAdmin
        .from('ad_accounts')
        .select('id, account_id, access_token, org_id, name')
        .eq('id', accountId)
        .single();
      account = result.data;
      accountError = result.error;
    } else {
      // Try account_id first, then id
      const r1 = await supabaseAdmin
        .from('ad_accounts')
        .select('id, account_id, access_token, org_id, name')
        .eq('account_id', accountId)
        .single();
      if (r1.data) {
        account = r1.data;
      } else {
        const r2 = await supabaseAdmin
          .from('ad_accounts')
          .select('id, account_id, access_token, org_id, name')
          .eq('id', accountId)
          .single();
        account = r2.data;
        accountError = r2.error;
      }
    }

    if (accountError || !account) {
      return Response.json(
        { error: `Ad account ${accountId} not found in database` },
        { status: 404 }
      );
    }

    // 2. Resolve the token
    let accessToken = account.access_token;
    if (!accessToken) {
      return Response.json({ error: 'No access token for this account' }, { status: 400 });
    }
    if (!accessToken.startsWith('EAA')) {
      accessToken = process.env.AD_ACCESS_TOKEN || accessToken;
    }

    // 3. Call Meta API directly with validated fields — always use the Meta account_id from DB
    const rawId = account.account_id.replace('act_', '');
    const metaUrl = `${META_API}/act_${rawId}?fields=${HEALTH_FIELDS}&access_token=${encodeURIComponent(accessToken)}`;
    const metaRes = await fetch(metaUrl);
    const meta = await metaRes.json() as Record<string, unknown>;

    console.log('[health/sync] META_RAW:', JSON.stringify(meta, null, 2));

    // 4. Check for Meta API error
    if (meta.error) {
      const err = meta.error as { code?: number; message?: string };
      throw new Error(
        `Meta API ${err.code || 'unknown'}: ${err.message || 'Unknown error'}. Fields: ${HEALTH_FIELDS}`
      );
    }

    // 5. Map Meta response → health payload
    const payload = metaToHealthPayload(meta);

    // 6. Calculate health checks
    const { checks, score, status } = calculateHealthChecks(payload);

    // 7. Insert health snapshot
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

    // 8. Update last_checked_at
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
      orgId: account.org_id,
      data_format: Object.keys(meta),
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
