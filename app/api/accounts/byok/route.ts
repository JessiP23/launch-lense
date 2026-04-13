export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// POST /api/accounts/byok
// Body: { access_token, account_id }
export async function POST(request: NextRequest) {
  try {
    const { access_token, account_id } = (await request.json()) as {
      access_token: string;
      account_id: string;
    };

    if (!access_token || !account_id) {
      return Response.json(
        { error: 'access_token and account_id are required' },
        { status: 400 }
      );
    }

    // Meta user/system tokens start with EAA...
    if (!/^EAA/i.test(access_token)) {
      return Response.json(
        { error: 'Only Meta User Access Tokens or System User Tokens are supported' },
        { status: 400 }
      );
    }

    // Normalise: ensure act_ prefix
    const metaAccountId = account_id.startsWith('act_')
      ? account_id
      : `act_${account_id}`;

    // Verify token against Meta Graph API
    let accountName = 'My Ad Account';
    const verifyRes = await fetch(
      `https://graph.facebook.com/v20.0/${metaAccountId}?fields=id,name,account_status&access_token=${encodeURIComponent(access_token)}`
    );
    const verifyData = (await verifyRes.json()) as {
      id?: string;
      name?: string;
      error?: { message: string };
    };

    if (verifyData.error) {
      return Response.json(
        { error: `Token validation failed: ${verifyData.error.message}` },
        { status: 400 }
      );
    }

    // Validate token owner and account access scope
    const meRes = await fetch(
      `https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${encodeURIComponent(access_token)}`
    );
    const meData = (await meRes.json()) as { id?: string; error?: { message: string } };
    if (meData.error || !meData.id) {
      return Response.json(
        { error: 'Invalid Meta token. Could not validate /me.' },
        { status: 400 }
      );
    }

    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v20.0/me/adaccounts?fields=id&access_token=${encodeURIComponent(access_token)}`
    );
    const adAccountsData = (await adAccountsRes.json()) as {
      data?: Array<{ id: string }>;
      error?: { message: string };
    };

    if (adAccountsData.error) {
      return Response.json(
        { error: `Token ad account check failed: ${adAccountsData.error.message}` },
        { status: 400 }
      );
    }

    const hasAccount = Boolean(
      adAccountsData.data?.some((a) => a.id === metaAccountId)
    );

    if (!hasAccount) {
      return Response.json(
        { error: 'Token does not have access to the provided Meta ad account' },
        { status: 400 }
      );
    }
    accountName = verifyData.name || accountName;

    // Resolve org_id: use an existing account's org_id so we don't violate FK
    const { data: existingOrg } = await supabaseAdmin
      .from('ad_accounts')
      .select('org_id')
      .not('org_id', 'is', null)
      .limit(1)
      .maybeSingle();

    const ORG_ID =
      existingOrg?.org_id ||
      process.env.DEFAULT_ORG_ID ||
      '00000000-0000-0000-0000-000000000001';

    // Upsert account
    const { data: existing } = await supabaseAdmin
      .from('ad_accounts')
      .select('id')
      .eq('account_id', metaAccountId)
      .maybeSingle();

    let internalId: string;

    if (existing) {
      await supabaseAdmin
        .from('ad_accounts')
        .update({ access_token, name: accountName, status: 'active' })
        .eq('id', existing.id);
      internalId = existing.id;
    } else {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('ad_accounts')
        .insert({
          org_id: ORG_ID,
          account_id: metaAccountId,
          name: accountName,
          access_token,
          status: 'active',
        })
        .select('id')
        .single();

      if (insertErr || !inserted) {
        return Response.json({ error: 'Failed to save account' }, { status: 500 });
      }
      internalId = inserted.id;
    }

    return Response.json({
      success: true,
      account: { id: internalId, account_id: metaAccountId, name: accountName },
      org_id: ORG_ID,
    });
  } catch (err) {
    console.error('[byok] Error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
