// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sprint/[sprint_id]/campaign/activate
//
// Final user-approval gate. The v10 pipeline leaves the Meta campaign and
// adsets in PAUSED state after creation; the user must explicitly approve
// the deployment via this endpoint, which:
//
//   1. Verifies at least one sprint_creative (channel='meta') is 'approved'
//      or already 'deployed' AND policy_severity != 'block'.
//   2. Loads the persisted sprint_campaigns row (campaign_id + adset_map).
//   3. Flips campaign → ACTIVE, then every adset → ACTIVE.
//   4. Updates sprint_campaigns.status to 'ACTIVE'.
//   5. Advances the sprint state to CAMPAIGN_RUNNING.
//   6. Emits campaign_activated.
//
// Idempotent: re-calling on an ACTIVE campaign is a no-op success.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { updateCampaignStatus, getSystemToken } from '@/lib/meta-api';
import { withMetaRetry } from '@/lib/meta/retry';
import { listCreatives } from '@/lib/creatives/store';
import { emitSprintEvent, SprintEventName } from '@/lib/analytics/events';

interface SprintCampaignRow {
  campaign_id: string;
  adset_map: Record<string, string>;
  status: string | null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;
  const db = createServiceClient();

  // 1. Approval gate — at least one approved meta creative, policy-clean.
  const creatives = await listCreatives(sprint_id);
  const metaCreatives = creatives.filter((c) => c.platform === 'meta');
  const deployable = metaCreatives.filter(
    (c) =>
      (c.status === 'approved' || c.status === 'deploying' || c.status === 'deployed') &&
      c.policy_severity !== 'block'
  );
  if (deployable.length === 0) {
    return Response.json(
      {
        error:
          'No approved creatives available. Approve at least one Meta creative before activating.',
      },
      { status: 409 }
    );
  }

  // 2. Load the persisted campaign record.
  const { data: row, error: loadErr } = await db
    .from('sprint_campaigns')
    .select('campaign_id, adset_map, status')
    .eq('sprint_id', sprint_id)
    .eq('channel', 'meta')
    .maybeSingle();
  if (loadErr) {
    return Response.json({ error: `Load failed: ${loadErr.message}` }, { status: 500 });
  }
  const campaign = row as SprintCampaignRow | null;
  if (!campaign?.campaign_id) {
    return Response.json(
      { error: 'No Meta campaign exists for this sprint. Run /campaign first.' },
      { status: 409 }
    );
  }

  // Already active — return early (idempotency).
  if (campaign.status === 'ACTIVE') {
    return Response.json({
      campaign_id: campaign.campaign_id,
      status: 'ACTIVE',
      already_active: true,
    });
  }

  const accessToken = getSystemToken();
  const adsetIds = Object.values(campaign.adset_map ?? {});

  // 3. Activate campaign first, then adsets. Order matters: an ACTIVE
  // adset under a PAUSED campaign is a no-op on Meta's side.
  try {
    await withMetaRetry(
      () => updateCampaignStatus(campaign.campaign_id, accessToken, 'ACTIVE'),
      { label: 'activate-campaign' }
    );
    for (const adsetId of adsetIds) {
      await withMetaRetry(
        () => updateCampaignStatus(adsetId, accessToken, 'ACTIVE'),
        { label: `activate-adset:${adsetId}` }
      );
    }
  } catch (err) {
    return Response.json(
      {
        error: `Meta activation failed: ${err instanceof Error ? err.message : 'unknown'}`,
      },
      { status: 502 }
    );
  }

  // 4. Persist new status.
  const { error: updErr } = await db
    .from('sprint_campaigns')
    .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
    .eq('sprint_id', sprint_id)
    .eq('channel', 'meta');
  if (updErr) console.warn('[activate] sprint_campaigns update:', updErr.message);

  // 5. Advance sprint state. Best-effort — don't fail the request if the
  // sprint already moved on (e.g., monitor cron raced ahead).
  const { error: sprintErr } = await db
    .from('sprints')
    .update({ state: 'CAMPAIGN_RUNNING', updated_at: new Date().toISOString() })
    .eq('id', sprint_id);
  if (sprintErr) console.warn('[activate] sprints update:', sprintErr.message);

  // 6. Analytics.
  void emitSprintEvent(sprint_id, SprintEventName.CampaignActivated, {
    campaign_id: campaign.campaign_id,
    adset_count: adsetIds.length,
    approved_creative_count: deployable.length,
  });

  return Response.json({
    campaign_id: campaign.campaign_id,
    status: 'ACTIVE',
    adset_count: adsetIds.length,
  });
}
