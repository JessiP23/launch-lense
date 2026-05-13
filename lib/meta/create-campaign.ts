// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — Managed Meta Campaign launcher
//
// Single source of truth for creating a Meta campaign from a sprint.
//
// Architecture:
//   Campaign (1 per sprint, objective=OUTCOME_LEADS)
//   └── AdSet × N angles (isolated for clean per-angle attribution)
//       └── Creative (link_data → LP with UTM)
//       └── Ad (tracks pixel for offsite conversions)
//
// All calls go through withMetaRetry. The function is idempotent: it checks
// `sprint_campaigns` for an existing record before creating new objects.
// On partial failure, created object IDs are persisted so a retry can resume.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
  updateCampaignStatus,
  getSystemToken,
  getSystemAdAccountId,
  getSystemPageId,
  getSystemPixelId,
} from '@/lib/meta-api';
import { withMetaRetry } from '@/lib/meta/retry';
import { createServiceClient } from '@/lib/supabase';
import { emitSprintEvent, SprintEventName } from '@/lib/analytics/events';
import type { AngleAgentOutput, LandingAgentOutput } from '@/lib/agents/types';

export interface LaunchCampaignInput {
  sprintId: string;
  idea: string;
  angles: AngleAgentOutput;
  landing: LandingAgentOutput | null;
  totalBudgetCents: number;
  /** Base URL for LP attribution links. Defaults to BASE_URL env. */
  baseUrl?: string;
  /** Override the standard 3-day pacing. */
  pacingDays?: number;
}

export interface LaunchCampaignResult {
  campaignId: string;
  adsetMap: Record<string, string>;    // angle_id → adset_id
  adMap: Record<string, string>;        // angle_id → ad_id
  dailyBudgetCents: number;
  reused: boolean;                       // true if an existing campaign was returned
}

// ── Budget pacing ──────────────────────────────────────────────────────────

export function perAngleDailyBudgetCents(
  totalBudgetCents: number,
  angleCount: number,
  days = 3
): number {
  return Math.max(500, Math.floor(totalBudgetCents / Math.max(1, angleCount) / days));
}

// ── Naming convention: LL_{SPRINT_PREFIX}_{CHANNEL}_{ANGLE} ────────────────

function nameFor(sprintId: string, channel: string, angleId?: string): string {
  const prefix = sprintId.slice(0, 8);
  return angleId ? `LL_${prefix}_${channel}_${angleId}` : `LL_${prefix}_${channel}`;
}

// ── Idempotency: look up existing record in sprint_campaigns ───────────────

interface ExistingCampaign {
  campaign_id: string;
  adset_map: Record<string, string>;
  ad_map: Record<string, string>;
}

async function findExistingCampaign(sprintId: string): Promise<ExistingCampaign | null> {
  const db = createServiceClient();
  const { data } = await db
    .from('sprint_campaigns')
    .select('campaign_id, adset_map, ad_map')
    .eq('sprint_id', sprintId)
    .eq('channel', 'meta')
    .maybeSingle();
  if (!data?.campaign_id) return null;
  return {
    campaign_id: data.campaign_id as string,
    adset_map: (data.adset_map as Record<string, string>) ?? {},
    ad_map: (data.ad_map as Record<string, string>) ?? {},
  };
}

interface PersistAdRow {
  angle_id: string;
  adset_id?: string;
  ad_id?: string;
  creative_id?: string;
  lp_url?: string;
  status?: string;
}

async function persistCampaign(
  sprintId: string,
  result: Omit<LaunchCampaignResult, 'reused'>,
  ads: PersistAdRow[],
  totalBudgetCents: number,
  campaignStatus: 'ACTIVE' | 'PAUSED' | 'FAILED' | 'CREATING' = 'ACTIVE'
): Promise<void> {
  const db = createServiceClient();
  const { data: campaignRow } = await db
    .from('sprint_campaigns')
    .upsert(
      {
        sprint_id: sprintId,
        channel: 'meta',
        campaign_id: result.campaignId,
        adset_map: result.adsetMap,
        ad_map: result.adMap,
        daily_budget_cents: result.dailyBudgetCents,
        total_budget_cents: totalBudgetCents,
        status: campaignStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'sprint_id,channel' }
    )
    .select('id')
    .single();

  if (campaignRow?.id && ads.length) {
    await db.from('sprint_ads').upsert(
      ads.map((a) => ({
        sprint_campaign_id: campaignRow.id,
        angle_id: a.angle_id,
        adset_id: a.adset_id ?? null,
        ad_id: a.ad_id ?? null,
        creative_id: a.creative_id ?? null,
        lp_url: a.lp_url ?? null,
        status: a.status ?? 'PAUSED',
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'sprint_campaign_id,angle_id' }
    );
  }
}

// ── LP URL builder with full UTM attribution ───────────────────────────────

export function buildLpUrl(args: {
  sprintId: string;
  angleId: string;
  channel: string;
  baseUrl: string;
  lpBase?: string | null;
}): string {
  const root = args.lpBase ?? `${args.baseUrl}/lp/${args.sprintId}`;
  const params = new URLSearchParams({
    utm_source: args.channel,
    utm_medium: 'paid',
    utm_campaign: `sprint_${args.sprintId.slice(0, 8)}`,
    utm_content: args.angleId,
    angle_id: args.angleId,
    sprint_id: args.sprintId,
  });
  const sep = root.includes('?') ? '&' : '?';
  return `${root}${sep}${params.toString()}`;
}

// ── Main launcher ──────────────────────────────────────────────────────────

export async function launchManagedMetaCampaign(
  input: LaunchCampaignInput
): Promise<LaunchCampaignResult> {
  const { sprintId, idea, angles, landing, totalBudgetCents } = input;
  if (!angles?.angles?.length) {
    throw new Error('launchManagedMetaCampaign: angles required');
  }

  // 0. Idempotency check.
  const existing = await findExistingCampaign(sprintId);
  if (existing) {
    return {
      campaignId: existing.campaign_id,
      adsetMap: existing.adset_map,
      adMap: existing.ad_map,
      dailyBudgetCents: perAngleDailyBudgetCents(totalBudgetCents, angles.angles.length, input.pacingDays),
      reused: true,
    };
  }

  const accessToken = getSystemToken();
  const adAccountId = getSystemAdAccountId();
  const pageId = getSystemPageId();
  const pixelId = getSystemPixelId();
  const baseUrl = input.baseUrl ?? process.env.BASE_URL ?? 'https://launchlense.com';

  // 1. Create the campaign (paused so we can wire up adsets before activation).
  const campaignName = `${nameFor(sprintId, 'meta')} — ${idea.slice(0, 40)}`;
  const campaignRes = (await withMetaRetry(
    () =>
      createCampaign(adAccountId, accessToken, {
        name: campaignName,
        objective: 'OUTCOME_LEADS',
        status: 'PAUSED',
        special_ad_categories: [],
        // Meta v20+ requires this explicit boolean whenever the campaign
        // does not carry a campaign-level budget. We use per-adset budgets
        // for clean per-angle attribution, so it must be `false`.
        is_adset_budget_sharing_enabled: false,
      }),
    { label: 'create-campaign' }
  )) as { id: string };

  const campaignId = campaignRes.id;
  const dailyBudgetCents = perAngleDailyBudgetCents(
    totalBudgetCents,
    angles.angles.length,
    input.pacingDays
  );

  const adsetMap: Record<string, string> = {};
  const adMap: Record<string, string> = {};
  const adRows: PersistAdRow[] = [];

  try {
    // 2. Per-angle adset + creative + ad.
    for (const angle of angles.angles) {
      const lpPage = landing?.pages?.find((p) => p.angle_id === angle.id);
      const lpBase = lpPage?.utm_base ?? null;
      const lpUrl = buildLpUrl({
        sprintId,
        angleId: angle.id,
        channel: 'meta',
        baseUrl,
        lpBase,
      });

      const adsetName = nameFor(sprintId, 'meta', angle.id);
      const adsetParams: Record<string, unknown> = {
        name: adsetName,
        campaign_id: campaignId,
        daily_budget: dailyBudgetCents,
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        billing_event: 'IMPRESSIONS',
        // OUTCOME_LEADS + WEBSITE destination requires OFFSITE_CONVERSIONS
        // (paired with a pixel via promoted_object). LEAD_GENERATION is for
        // native Meta Lead Forms only.
        optimization_goal: 'OFFSITE_CONVERSIONS',
        status: 'PAUSED',
        destination_type: 'WEBSITE',
        targeting: {
          // Advantage+ audience requires age_max >= 65.
          age_min: 18,
          age_max: 65,
          publisher_platforms: ['facebook', 'instagram'],
          device_platforms: ['mobile', 'desktop'],
          // Required by Meta v20+: explicit Advantage Audience opt-in.
          targeting_automation: { advantage_audience: 1 },
        },
        ...(pixelId
          ? { promoted_object: { pixel_id: pixelId, custom_event_type: 'LEAD' } }
          : {}),
      };

      const adsetRes = (await withMetaRetry(
        () => createAdSet(adAccountId, accessToken, adsetParams),
        { label: `create-adset:${angle.id}` }
      )) as { id: string };
      adsetMap[angle.id] = adsetRes.id;

      const copy = angle.copy.meta;
      const creativeRes = (await withMetaRetry(
        () =>
          createAdCreative(adAccountId, accessToken, {
            name: `Creative — ${adsetName}`,
            object_story_spec: {
              page_id: pageId,
              link_data: {
                message: copy.body,
                link: lpUrl,
                name: copy.headline,
                call_to_action: { type: 'LEARN_MORE' },
              },
            },
          }),
        { label: `create-creative:${angle.id}` }
      )) as { id: string };

      const adRes = (await withMetaRetry(
        () =>
          createAd(adAccountId, accessToken, {
            name: `Ad — ${adsetName}`,
            adset_id: adsetRes.id,
            creative: { creative_id: creativeRes.id },
            status: 'PAUSED',
            tracking_specs: pixelId
              ? [{ action: ['offsite_conversions'], pixel: [pixelId] }]
              : [],
          }),
        { label: `create-ad:${angle.id}` }
      )) as { id: string };
      adMap[angle.id] = adRes.id;
      adRows.push({
        angle_id: angle.id,
        adset_id: adsetRes.id,
        ad_id: adRes.id,
        creative_id: creativeRes.id,
        lp_url: lpUrl,
        status: 'ACTIVE',
      });
    }

    // 3. Activate campaign then all adsets (avoids partial-active state).
    await withMetaRetry(
      () => updateCampaignStatus(campaignId, accessToken, 'ACTIVE'),
      { label: 'activate-campaign' }
    );
    for (const adsetId of Object.values(adsetMap)) {
      await withMetaRetry(
        () => updateCampaignStatus(adsetId, accessToken, 'ACTIVE'),
        { label: `activate-adset:${adsetId}` }
      );
    }

    const result = { campaignId, adsetMap, adMap, dailyBudgetCents };
    await persistCampaign(sprintId, result, adRows, totalBudgetCents, 'ACTIVE');

    // Fire analytics — campaign_created is the canonical "campaign live" event
    // for the managed orchestration. Fire-and-forget; never blocks launch.
    void emitSprintEvent(sprintId, SprintEventName.CampaignCreated, {
      channel: 'meta',
      campaign_id: campaignId,
      angle_count: angles.angles.length,
      daily_budget_cents: dailyBudgetCents,
      total_budget_cents: totalBudgetCents,
    });

    return { ...result, reused: false };
  } catch (err) {
    // Persist whatever we created so a follow-up call can resume / clean up.
    await persistCampaign(
      sprintId,
      { campaignId, adsetMap, adMap, dailyBudgetCents },
      adRows,
      totalBudgetCents,
      'CREATING'
    );
    throw err;
  }
}
