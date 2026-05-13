// POST /api/sprint/[sprint_id]/campaign
//
// Creates a full Meta campaign from angles + landing pages.
//
// Architecture: MANAGED ACCOUNT
//   LaunchLense owns the Business Manager, Ad Account, Page, and Pixel.
//   No founder OAuth required. Uses SYSTEM_META_ACCESS_TOKEN (server-only).
//
// Campaign structure per sprint:
//   1 Campaign (objective = OUTCOME_LEADS, status = PAUSED initially)
//   └── 1 Adset per angle (3 total) — isolated for clean CTR comparison
//       └── 1 Ad per adset — uses LP URL with UTM attribution
//
// After creation, campaign status is set to ACTIVE and sprint advances to CAMPAIGN_RUNNING.
// Campaign monitoring and verdict dispatch are handled by /api/cron/sprint-monitor.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase';
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
import { buildLpUrl } from '@/lib/meta/create-campaign';
import { emitSprintEvent, SprintEventName } from '@/lib/analytics/events';
import type { AngleAgentOutput, LandingAgentOutput, Platform, CampaignAgentOutput, AngleMetrics } from '@/lib/agents/types';

const SANDBOX_MODE = process.env.ADS_API_MODE === 'sandbox';

// ── Budget math ────────────────────────────────────────────────────────────
// Default: 3-day sprint, budget split equally across angles.

function perAngleDailyBudgetCents(totalBudgetCents: number, angleCount: number, days = 3): number {
  return Math.max(500, Math.floor(totalBudgetCents / angleCount / days));
}

// ── Sandbox stub ──────────────────────────────────────────────────────────

function makeSandboxCampaignResult(sprintId: string, angles: AngleAgentOutput): Record<Platform, CampaignAgentOutput> {
  const fakeAngles: AngleMetrics[] = angles.angles.map((a) => ({
    id: a.id,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    cpc_cents: 0,
    spend_cents: 0,
    status: 'PASS',
  }));

  const base: CampaignAgentOutput = {
    channel: 'meta',
    status: 'ACTIVE',
    campaign_id: `sandbox_campaign_${sprintId.slice(0, 8)}`,
    campaign_start_time: new Date().toISOString(),
    budget_cents: 15000,
    spent_cents: 0,
    angle_metrics: fakeAngles,
    last_polled_at: new Date().toISOString(),
  };

  return { meta: base, google: { ...base, channel: 'google', campaign_id: null, status: 'PENDING' }, linkedin: { ...base, channel: 'linkedin', campaign_id: null, status: 'PENDING' }, tiktok: { ...base, channel: 'tiktok', campaign_id: null, status: 'PENDING' } };
}

// ── Main handler ──────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;

  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const db = createServiceClient();
  const { data: sprint, error: sprintErr } = await db
    .from('sprints')
    .select('*')
    .eq('id', sprint_id)
    .single();

  if (sprintErr || !sprint) return Response.json({ error: 'Sprint not found' }, { status: 404 });

  if (!['ANGLES_DONE', 'LANDING_DONE'].includes(sprint.state)) {
    return Response.json(
      { error: `Sprint must be in ANGLES_DONE or LANDING_DONE to launch campaigns (current: ${sprint.state})` },
      { status: 409 }
    );
  }

  const angles = sprint.angles as AngleAgentOutput | null;
  if (!angles?.angles?.length) {
    return Response.json({ error: 'No angles generated yet' }, { status: 422 });
  }

  const landing = sprint.landing as LandingAgentOutput | null;
  const baseUrl = process.env.BASE_URL ?? 'https://launchlense.com';

  // ── Advance state to CAMPAIGN_CREATING ────────────────────────────────────
  await db
    .from('sprints')
    .update({ state: 'CAMPAIGN_RUNNING', updated_at: new Date().toISOString() })
    .eq('id', sprint_id);

  await db.from('sprint_events').insert({
    sprint_id,
    agent: 'campaign',
    event_type: 'creating',
    payload: { channels: sprint.active_channels, sandbox: SANDBOX_MODE },
  });

  // ── Sandbox path ──────────────────────────────────────────────────────────
  if (SANDBOX_MODE) {
    const campaignData = makeSandboxCampaignResult(sprint_id, angles);
    await db
      .from('sprints')
      .update({ campaign: campaignData, updated_at: new Date().toISOString() })
      .eq('id', sprint_id);

    await db.from('sprint_events').insert({
      sprint_id,
      agent: 'campaign',
      event_type: 'created',
      payload: { sandbox: true, campaign_id: campaignData.meta.campaign_id },
    });

    await emitSprintEvent(sprint_id, SprintEventName.CampaignLaunched, {
      channels: ['meta'],
      total_budget_cents: sprint.budget_cents,
      campaign_ids: { meta: campaignData.meta.campaign_id ?? '' },
    });

    return Response.json({ sprint_id, state: 'CAMPAIGN_RUNNING', sandbox: true, campaign: campaignData });
  }

  // ── Production Meta campaign creation ─────────────────────────────────────
  try {
    const accessToken = getSystemToken();
    const adAccountId = getSystemAdAccountId();
    const pageId = getSystemPageId();
    const pixelId = getSystemPixelId();

    const idea = sprint.idea as string;
    const campaignName = `LL Sprint ${sprint_id.slice(0, 8)} — ${idea.slice(0, 40)}`;

    // 1. Create the campaign (retried on transient Meta errors)
    const campaignRes = (await withMetaRetry(
      () => createCampaign(adAccountId, accessToken, {
        name: campaignName,
        objective: 'OUTCOME_LEADS',
        status: 'PAUSED',
        special_ad_categories: [],
        // Meta v20+ requires this whenever there is no campaign-level CBO budget.
        is_adset_budget_sharing_enabled: false,
      }),
      { label: 'create-campaign' }
    )) as { id: string };

    const campaignId = campaignRes.id;

    // 2. Create one adset per angle
    const adsetMap: Record<string, string> = {}; // angle_id → adset_id
    const adMap: Record<string, string> = {};     // angle_id → ad_id
    const totalBudget = sprint.budget_cents as number;
    const dailyBudget = perAngleDailyBudgetCents(totalBudget, angles.angles.length);

    const angleMetrics: AngleMetrics[] = [];
    const adRows: Array<{
      angle_id: string;
      adset_id: string;
      ad_id: string;
      creative_id: string;
      lp_url: string;
      status: string;
    }> = [];

    for (const angle of angles.angles) {
      // Get LP URL for this angle with full UTM attribution (utm_*, angle_id, sprint_id).
      const lpPage = landing?.pages?.find((p) => p.angle_id === angle.id);
      const lpUrl = buildLpUrl({
        sprintId: sprint_id,
        angleId: angle.id,
        channel: 'meta',
        baseUrl,
        lpBase: lpPage?.utm_base ?? null,
      });

      const adsetName = `${angle.id.replace('_', ' ')} — ${angle.archetype}`;

      // Adset: mobile-first, Advantage+ audience, leads optimization
      const adsetParams: Record<string, unknown> = {
        name: adsetName,
        campaign_id: campaignId,
        daily_budget: dailyBudget,
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        billing_event: 'IMPRESSIONS',
        // OUTCOME_LEADS + WEBSITE destination requires OFFSITE_CONVERSIONS,
        // not LEAD_GENERATION (which is reserved for native Meta Lead Forms).
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
          ? {
              promoted_object: {
                pixel_id: pixelId,
                custom_event_type: 'LEAD',
              },
            }
          : {}),
      };

      const adsetRes = (await withMetaRetry(
        () => createAdSet(adAccountId, accessToken, adsetParams),
        { label: `create-adset:${angle.id}` }
      )) as { id: string };
      adsetMap[angle.id] = adsetRes.id;

      // Creative
      const copy = angle.copy.meta;
      const creativeRes = (await withMetaRetry(
        () => createAdCreative(adAccountId, accessToken, {
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

      // Ad
      const adRes = (await withMetaRetry(
        () => createAd(adAccountId, accessToken, {
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

      // Persist normalized sprint_ads row
      adRows.push({
        angle_id: angle.id,
        adset_id: adsetRes.id,
        ad_id: adRes.id,
        creative_id: creativeRes.id,
        lp_url: lpUrl,
        status: 'PAUSED',
      });

      angleMetrics.push({
        id: angle.id,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpc_cents: 0,
        spend_cents: 0,
        status: 'PASS',
      });
    }

    // 3. Activate the campaign (adsets remain paused until all are set up)
    await withMetaRetry(() => updateCampaignStatus(campaignId, accessToken, 'ACTIVE'), { label: 'activate-campaign' });

    // 4. Activate all adsets
    for (const adsetId of Object.values(adsetMap)) {
      await withMetaRetry(() => updateCampaignStatus(adsetId, accessToken, 'ACTIVE'), { label: `activate-adset:${adsetId}` });
    }

    // 4b. Persist normalized sprint_campaigns + sprint_ads rows.
    const { data: campaignRow } = await db
      .from('sprint_campaigns')
      .upsert(
        {
          sprint_id,
          channel: 'meta',
          campaign_id: campaignId,
          adset_map: adsetMap,
          ad_map: adMap,
          daily_budget_cents: dailyBudget,
          total_budget_cents: totalBudget,
          status: 'ACTIVE',
          last_polled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'sprint_id,channel' }
      )
      .select('id')
      .single();
    if (campaignRow?.id && adRows.length > 0) {
      await db.from('sprint_ads').upsert(
        adRows.map((r) => ({ ...r, sprint_campaign_id: campaignRow.id, status: 'ACTIVE' })),
        { onConflict: 'sprint_campaign_id,angle_id' }
      );
    }

    // 5. Persist to sprint
    const campaignData: Record<Platform, CampaignAgentOutput> = {
      meta: {
        channel: 'meta',
        status: 'ACTIVE',
        campaign_id: campaignId,
        campaign_start_time: new Date().toISOString(),
        budget_cents: totalBudget,
        spent_cents: 0,
        angle_metrics: angleMetrics,
        last_polled_at: new Date().toISOString(),
      },
      google: { channel: 'google', status: 'PENDING', campaign_id: null, campaign_start_time: null, budget_cents: 0, spent_cents: 0, angle_metrics: [], last_polled_at: null },
      linkedin: { channel: 'linkedin', status: 'PENDING', campaign_id: null, campaign_start_time: null, budget_cents: 0, spent_cents: 0, angle_metrics: [], last_polled_at: null },
      tiktok: { channel: 'tiktok', status: 'PENDING', campaign_id: null, campaign_start_time: null, budget_cents: 0, spent_cents: 0, angle_metrics: [], last_polled_at: null },
    };

    // Store the adset_id map for the monitor to use in polling
    const adsetMapping = Object.fromEntries(
      Object.entries(adsetMap).map(([angleId, adsetId]) => [angleId, adsetId])
    );

    await db
      .from('sprints')
      .update({
        campaign: campaignData,
        // Store adset mapping in a separate key so the monitor can find adset IDs
        angles: { ...(sprint.angles as object), _meta_adset_map: adsetMapping },
        updated_at: new Date().toISOString(),
      })
      .eq('id', sprint_id);

    await db.from('sprint_events').insert({
      sprint_id,
      agent: 'campaign',
      event_type: 'created',
      payload: {
        campaign_id: campaignId,
        adset_ids: adsetMap,
        ad_ids: adMap,
        daily_budget_cents: dailyBudget,
      },
    });

    await emitSprintEvent(sprint_id, SprintEventName.CampaignLaunched, {
      channels: ['meta'],
      total_budget_cents: totalBudget,
      campaign_ids: { meta: campaignId },
    });

    return Response.json({
      sprint_id,
      state: 'CAMPAIGN_RUNNING',
      campaign_id: campaignId,
      adset_ids: adsetMap,
      sandbox: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[campaign] Sprint ${sprint_id} campaign creation error:`, message);

    await db
      .from('sprints')
      .update({ state: 'BLOCKED', blocked_reason: `Campaign creation failed: ${message}`, updated_at: new Date().toISOString() })
      .eq('id', sprint_id);

    await db.from('sprint_events').insert({
      sprint_id,
      agent: 'campaign',
      event_type: 'failed',
      payload: { error: message },
    });

    return Response.json({ error: message }, { status: 500 });
  }
}
