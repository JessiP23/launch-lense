export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    // Fetch all ad accounts with latest health snapshot score
    const { data: accounts, error } = await supabaseAdmin
      .from('ad_accounts')
      .select('id, account_id, name, org_id');

    if (error) {
      console.error('[api/accounts] ad_accounts query error:', JSON.stringify(error));
      return Response.json({ error: error.message }, { status: 500 });
    }

    // For each account, get the latest health snapshot
    const enriched = await Promise.all(
      (accounts || []).map(async (a) => {
        const { data: snapshot } = await supabaseAdmin
          .from('health_snapshots')
          .select('score, status')
          .eq('ad_account_id', a.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          id: a.id,
          account_id: a.account_id,
          name: a.name,
          status: 'active',
          health_score: snapshot?.score ?? null,
          health_status: snapshot?.status ?? null,
          last_checked_at: null,
        };
      })
    );

    return Response.json({ accounts: enriched });
  } catch (error) {
    console.error('[api/accounts] Unhandled exception:', error instanceof Error ? error.stack : error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}
