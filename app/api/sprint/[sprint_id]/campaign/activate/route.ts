// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sprint/[sprint_id]/campaign/activate
//
// Single-button "Launch live ads" endpoint. Owns the entire deploy step:
//
//   1. Verifies at least one sprint_creative (channel='meta') is 'approved'
//      or already 'deployed' AND policy_severity != 'block'.
//   2. If no sprint_campaigns row exists yet, LAZILY creates the paused Meta
//      campaign + adsets + ads via launchManagedMetaCampaign (or a sandbox
//      stub when ADS_API_MODE=sandbox). This removes the old foot-gun where
//      the UI had to remember to call /campaign before /campaign/activate.
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
import { launchManagedMetaCampaign, type LaunchTargeting } from '@/lib/meta/create-campaign';
import type { AngleAgentOutput, LandingAgentOutput } from '@/lib/agents/types';

const SANDBOX_MODE = process.env.ADS_API_MODE === 'sandbox';
const COUNTRY_RX = /^[A-Z]{2}$/;

// Resolves the user-facing targeting for this activation. Precedence:
//   1. POST body `{ countries: string[] }`.
//   2. Edge geo header (`x-vercel-ip-country` / `cf-ipcountry`).
//   3. `META_DEFAULT_COUNTRIES` env.
//   4. 'US' fallback.
// We sanitise to ISO-2 uppercase to match Meta's expectation.
function resolveTargeting(req: NextRequest, bodyCountries: string[] | null): LaunchTargeting {
  const sanitise = (arr: string[]): string[] =>
    arr.map((c) => c.trim().toUpperCase()).filter((c) => COUNTRY_RX.test(c));

  if (bodyCountries && bodyCountries.length) {
    const cleaned = sanitise(bodyCountries);
    if (cleaned.length) return { countries: cleaned };
  }
  const headerGeo =
    req.headers.get('x-vercel-ip-country') ??
    req.headers.get('cf-ipcountry') ??
    '';
  const headerClean = sanitise([headerGeo]);
  if (headerClean.length) return { countries: headerClean };

  const envClean = sanitise((process.env.META_DEFAULT_COUNTRIES ?? '').split(','));
  if (envClean.length) return { countries: envClean };

  return { countries: ['US'] };
}

interface SprintCampaignRow {
  campaign_id: string;
  adset_map: Record<string, string>;
  status: string | null;
}

interface SprintRow {
  idea: string;
  budget_cents: number;
  angles: AngleAgentOutput | null;
  landing: LandingAgentOutput | null;
}

// Lazy creation step: builds the paused Meta campaign (or a sandbox row)
// so the activation flip below has something to flip.
async function ensureCampaignCreated(
  sprintId: string,
  db: ReturnType<typeof createServiceClient>,
  targeting: LaunchTargeting
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: sprint, error } = await db
    .from('sprints')
    .select('idea, budget_cents, angles, landing')
    .eq('id', sprintId)
    .single<SprintRow>();
  if (error || !sprint) return { ok: false, error: 'Sprint not found', status: 404 };
  if (!sprint.angles?.angles?.length) {
    return { ok: false, error: 'No angles generated yet', status: 422 };
  }

  if (SANDBOX_MODE) {
    // Sandbox: insert a deterministic fake row so activation can proceed
    // without hitting Meta. Mirrors the shape produced by the live path.
    const fakeCampaignId = `sbx_campaign_${sprintId.slice(0, 8)}`;
    const adsetMap: Record<string, string> = {};
    const adMap: Record<string, string> = {};
    for (const a of sprint.angles.angles) {
      adsetMap[a.id] = `sbx_adset_${sprintId.slice(0, 8)}_${a.id}`;
      adMap[a.id] = `sbx_ad_${sprintId.slice(0, 8)}_${a.id}`;
    }
    const { error: insErr } = await db.from('sprint_campaigns').upsert(
      {
        sprint_id: sprintId,
        channel: 'meta',
        campaign_id: fakeCampaignId,
        adset_map: adsetMap,
        ad_map: adMap,
        daily_budget_cents: Math.floor(sprint.budget_cents / sprint.angles.angles.length / 3),
        total_budget_cents: sprint.budget_cents,
        status: 'PAUSED',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'sprint_id,channel' }
    );
    if (insErr) return { ok: false, error: `Sandbox create failed: ${insErr.message}`, status: 500 };
    return { ok: true };
  }

  try {
    await launchManagedMetaCampaign({
      sprintId,
      idea: sprint.idea,
      angles: sprint.angles,
      landing: sprint.landing,
      totalBudgetCents: sprint.budget_cents,
      targeting,
      requireApprovedCreatives: true,
      autoActivate: false, // we activate below
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `Campaign creation failed: ${err instanceof Error ? err.message : 'unknown'}`,
      status: 502,
    };
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;
  const db = createServiceClient();

  // 0. Resolve the user-confirmed (or auto-detected) launch targeting.
  // Body is optional — clicking "Launch" without a body still works thanks
  // to the header → env → 'US' fallback chain.
  const body = (await req.json().catch(() => null)) as {
    countries?: string[];
  } | null;
  const targeting = resolveTargeting(req, body?.countries ?? null);

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

  // 2. Load the persisted campaign record. If it doesn't exist yet, lazily
  // create it (paused) so the activation flip below has something real to
  // flip. This collapses the old two-call dance into one button click.
  const loadRow = async () => {
    const { data, error } = await db
      .from('sprint_campaigns')
      .select('campaign_id, adset_map, status')
      .eq('sprint_id', sprint_id)
      .eq('channel', 'meta')
      .maybeSingle();
    if (error) throw new Error(`Load failed: ${error.message}`);
    return data as SprintCampaignRow | null;
  };

  let campaign: SprintCampaignRow | null;
  try {
    campaign = await loadRow();
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }

  if (!campaign?.campaign_id) {
    const created = await ensureCampaignCreated(sprint_id, db, targeting);
    if (!created.ok) {
      return Response.json({ error: created.error }, { status: created.status });
    }
    try {
      campaign = await loadRow();
    } catch (err) {
      return Response.json({ error: (err as Error).message }, { status: 500 });
    }
    if (!campaign?.campaign_id) {
      return Response.json(
        { error: 'Campaign creation succeeded but row not persisted.' },
        { status: 500 }
      );
    }
  }

  // Already active — return early (idempotency).
  if (campaign.status === 'ACTIVE') {
    return Response.json({
      campaign_id: campaign.campaign_id,
      status: 'ACTIVE',
      already_active: true,
      targeting,
    });
  }

  const adsetIds = Object.values(campaign.adset_map ?? {});

  // 3. Activate campaign first, then adsets. Order matters: an ACTIVE
  // adset under a PAUSED campaign is a no-op on Meta's side.
  // In sandbox mode we skip the live Meta calls entirely.
  if (!SANDBOX_MODE) {
    const accessToken = getSystemToken();
    try {
      await withMetaRetry(
        () => updateCampaignStatus(campaign!.campaign_id, accessToken, 'ACTIVE'),
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
    targeting,
  });
}
