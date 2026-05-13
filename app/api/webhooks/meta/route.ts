export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { updateCampaignStatus, getSystemToken } from '@/lib/meta-api';
import { getToken } from '@/lib/meta';
import { createServiceClient } from '@/lib/supabase';

// Meta `X-Hub-Signature-256` verification (HMAC-SHA256 using META_APP_SECRET).
function verifyMetaSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  // Both header and expected are equal-length hex strings; timingSafeEqual requires same length.
  try {
    return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

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

// ── Helpers: find sprint by Meta campaign/adset/ad ID ──────────────────────

async function findSprintByMetaObject(
  objectId: string
): Promise<{ sprint_id: string; campaign_id: string } | null> {
  const db = createServiceClient();
  // 1. campaign_id exact match
  const { data: byCampaign } = await db
    .from('sprint_campaigns')
    .select('sprint_id, campaign_id')
    .eq('campaign_id', objectId)
    .maybeSingle();
  if (byCampaign) return byCampaign as { sprint_id: string; campaign_id: string };

  // 2. search adset_map / ad_map JSONB (small table, exact-value search)
  const { data: rows } = await db
    .from('sprint_campaigns')
    .select('sprint_id, campaign_id, adset_map, ad_map');
  for (const r of rows ?? []) {
    const adsets = Object.values((r.adset_map ?? {}) as Record<string, string>);
    const ads = Object.values((r.ad_map ?? {}) as Record<string, string>);
    if (adsets.includes(objectId) || ads.includes(objectId)) {
      return { sprint_id: r.sprint_id as string, campaign_id: r.campaign_id as string };
    }
  }
  return null;
}

async function pauseSprintCampaign(sprintId: string, campaignId: string, reason: string) {
  const db = createServiceClient();
  try {
    const token = getSystemToken();
    await updateCampaignStatus(campaignId, token, 'PAUSED');
  } catch (err) {
    console.warn('[meta-webhook] pause failed:', String(err));
  }
  await db
    .from('sprint_campaigns')
    .update({ status: 'POLICY_BLOCKED', updated_at: new Date().toISOString() })
    .eq('sprint_id', sprintId)
    .eq('channel', 'meta');
  await db.from('sprint_events').insert({
    sprint_id: sprintId,
    agent: 'meta-webhook',
    event_type: 'auto_paused',
    channel: 'meta',
    payload: { reason, campaign_id: campaignId },
  });
}

// Meta webhook handler (POST)
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Signature verification (production-safe; in dev with missing secret we
  // fall back to permissive mode but log a clear warning).
  const sig = req.headers.get('x-hub-signature-256');
  if (process.env.META_APP_SECRET) {
    if (!verifyMetaSignature(rawBody, sig)) {
      console.warn('[meta-webhook] signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } else {
    console.warn('[meta-webhook] META_APP_SECRET missing — signature unverified');
  }

  let body: { entry?: Array<{ id?: string; changes?: Array<{ field: string; value: unknown }> }> };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    for (const entry of body.entry ?? []) {
      const entryId = entry.id ?? '';
      for (const change of entry.changes ?? []) {
        const value = change.value as Record<string, unknown>;
        const field = change.field;

        // ── (A) Legacy: account-level status flips → pause linked tests ──
        const accountStatusValue =
          typeof change.value === 'string'
            ? change.value
            : (value.account_status as string | undefined) ?? '';
        if (field === 'account_status' && accountStatusValue && accountStatusValue !== 'ACTIVE' && entryId) {
          const accountId = `act_${entryId}`;
          const { data: account } = await supabaseAdmin
            .from('ad_accounts')
            .select('id, account_id')
            .eq('account_id', accountId)
            .single();
          if (account) {
            const accessToken = await getToken(account.account_id);
            const { data: tests } = await supabaseAdmin
              .from('tests')
              .select('id, campaign_id')
              .eq('ad_account_id', account.id)
              .eq('status', 'active');
            for (const t of tests ?? []) {
              try {
                if (t.campaign_id && accessToken) {
                  await updateCampaignStatus(t.campaign_id, accessToken, 'PAUSED');
                }
                await supabaseAdmin.from('tests').update({ status: 'paused' }).eq('id', t.id);
                await supabaseAdmin.from('annotations').insert({
                  test_id: t.id,
                  author: 'system',
                  message: `Auto-paused: Account ${accountId} status changed by Meta`,
                });
              } catch (pauseErr) {
                console.error(`[meta-webhook] pause test ${t.id} failed:`, pauseErr);
              }
            }
          }
        }

        // ── (B) Managed sprint: campaign/ad-level signals ────────────────
        // Meta sends fields like: ad_review, campaign_review, ad_account_review,
        // ad_account_spend, ad_account_billing_charge, learning_phase_state.
        const objectId = (value.campaign_id ?? value.adset_id ?? value.ad_id ?? entryId) as string;
        const sprint = objectId ? await findSprintByMetaObject(objectId) : null;
        if (!sprint) continue;

        if (
          field === 'ad_review' ||
          field === 'campaign_review' ||
          field === 'ad_account_review'
        ) {
          const status = (value.review_status as string) ?? (value.status as string) ?? '';
          if (status === 'REJECTED' || status === 'DISAPPROVED') {
            await pauseSprintCampaign(
              sprint.sprint_id,
              sprint.campaign_id,
              `policy:${status}:${String(value.reason ?? value.review_feedback ?? 'unspecified')}`
            );
          } else {
            await createServiceClient().from('sprint_events').insert({
              sprint_id: sprint.sprint_id,
              agent: 'meta-webhook',
              event_type: field,
              channel: 'meta',
              payload: value,
            });
          }
          continue;
        }

        if (field === 'ad_account_spend' || field === 'ad_account_billing_charge') {
          const spendCents = Math.round(Number(value.amount_spent ?? value.amount ?? 0) * 100);
          await createServiceClient().from('sprint_events').insert({
            sprint_id: sprint.sprint_id,
            agent: 'meta-webhook',
            event_type: 'spend_update',
            channel: 'meta',
            payload: { spend_cents: spendCents, raw: value },
          });
          continue;
        }

        if (field === 'learning_phase_state' || field === 'learning_phase') {
          await createServiceClient().from('sprint_events').insert({
            sprint_id: sprint.sprint_id,
            agent: 'meta-webhook',
            event_type: 'learning_state',
            channel: 'meta',
            payload: value,
          });
          continue;
        }

        // Unknown field — log raw for observability.
        await createServiceClient().from('sprint_events').insert({
          sprint_id: sprint.sprint_id,
          agent: 'meta-webhook',
          event_type: `unknown:${field}`,
          channel: 'meta',
          payload: value,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[meta-webhook] processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
