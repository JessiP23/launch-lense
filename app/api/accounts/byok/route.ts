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
    accountName = verifyData.name || accountName;

    const ORG_ID =
      process.env.DEFAULT_ORG_ID || '00000000-0000-0000-0000-000000000001';

    // Upsert account
    const { data: existing } = await supabaseAdmin
      .from('ad_accounts')
      .select('id')
      .eq('account_id', metaAccountId)
      .single();

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
