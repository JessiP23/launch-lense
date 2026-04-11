export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { updateCampaignStatus } from '@/lib/meta-api';

// Meta webhook verification (GET)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (
    searchParams.get('hub.mode') === 'subscribe' &&
    searchParams.get('hub.verify_token') === process.env.META_WEBHOOK_VERIFY_TOKEN
  ) {
    return new Response(searchParams.get('hub.challenge'), { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// Meta webhook handler (POST)
export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === 'account_status' && change.value !== 'ACTIVE') {
          const accountId = `act_${entry.id}`;

          // Find the ad account and its token
          const { data: account } = await supabaseAdmin
            .from('ad_accounts')
            .select('id, access_token')
            .eq('account_id', accountId)
            .single();

          if (!account) continue;

          // Get the real token from Vault if it's a vault reference
          const accessToken = await resolveToken(account.access_token);

          // Find all active tests for this account
          const { data: tests } = await supabaseAdmin
            .from('tests')
            .select('id, campaign_id')
            .eq('ad_account_id', account.id)
            .eq('status', 'active');

          for (const t of tests || []) {
            try {
              // Pause on Meta
              if (t.campaign_id && accessToken) {
                await updateCampaignStatus(t.campaign_id, accessToken, 'PAUSED');
              }

              // Update DB
              await supabaseAdmin
                .from('tests')
                .update({ status: 'paused' })
                .eq('id', t.id);

              // Annotation
              await supabaseAdmin.from('annotations').insert({
                test_id: t.id,
                author: 'system',
                message: `Auto-paused: Account ${accountId} status changed by Meta`,
              });
            } catch (pauseErr) {
              console.error(`[WEBHOOK] Failed to pause test ${t.id}:`, pauseErr);
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Resolve access token — if stored as vault reference, fetch from Vault
async function resolveToken(tokenOrRef: string | null): Promise<string | null> {
  if (!tokenOrRef) return null;
  // If it's already a raw token (starts with EAA), return as-is
  if (tokenOrRef.startsWith('EAA')) return tokenOrRef;
  // Otherwise try Vault lookup
  try {
    const { data } = await supabaseAdmin.rpc('vault.decrypted_secrets', {}).select('decrypted_secret').eq('name', tokenOrRef).single();
    return data?.decrypted_secret || tokenOrRef;
  } catch {
    return tokenOrRef;
  }
}
