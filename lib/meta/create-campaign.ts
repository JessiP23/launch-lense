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
  createAdImage,
  createAdVideo,
  updateCampaignStatus,
  getSystemToken,
  getSystemAdAccountId,
  getSystemPageId,
  getSystemPixelId,
} from '@/lib/meta-api';
import { withMetaRetry } from '@/lib/meta/retry';
import { createServiceClient } from '@/lib/supabase';
import { emitSprintEvent, SprintEventName } from '@/lib/analytics/events';
import type {
  AngleAgentOutput,
  LandingAgentOutput,
  SprintCreative,
} from '@/lib/agents/types';
import {
  getDeployableCreatives,
  setMetaAssetRefs,
  setMetaCreativeRefs,
  transitionStatus,
} from '@/lib/creatives/store';

export interface LaunchTargeting {
  /** ISO-2 country codes (e.g. ['US', 'GB']). At least one is required by
   * Meta v20+; the route auto-detects when omitted. */
  countries: string[];
}

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
  /** Per-sprint geo targeting. When omitted, falls back to env default. */
  targeting?: LaunchTargeting;
  /**
   * v10 approval gate. When true (default), the launcher will:
   *   1. Refuse to run if no approved sprint_creatives exist for 'meta'.
   *   2. Use the edited copy + uploaded image_hash from sprint_creatives,
   *      falling back to the raw angle.copy.meta values when a creative is
   *      not present.
   *   3. Skip auto-activation — campaigns stay PAUSED until the user calls
   *      /api/sprint/[id]/campaign/activate.
   */
  requireApprovedCreatives?: boolean;
  /** When false, the legacy auto-activation path runs (kept for tests). */
  autoActivate?: boolean;
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
    .select('campaign_id, adset_map, ad_map, status')
    .eq('sprint_id', sprintId)
    .eq('channel', 'meta')
    .maybeSingle();
  if (!data?.campaign_id) return null;
  const adsetMap = (data.adset_map as Record<string, string>) ?? {};
  // Only reuse rows that are fully provisioned. Rows left in 'CREATING' or
  // 'FAILED' state (after a partial Meta failure mid-flight) have an empty
  // or partial adset_map; re-running the full creation flow is the safe
  // recovery path. The Meta-side campaign object that was already created
  // gets re-named/re-used implicitly when we POST a new campaign with the
  // same idempotent name — Meta does not de-duplicate but the orphaned
  // paused campaign costs nothing.
  const status = (data.status as string | null) ?? '';
  const provisioned = (status === 'PAUSED' || status === 'ACTIVE') && Object.keys(adsetMap).length > 0;
  if (!provisioned) return null;
  return {
    campaign_id: data.campaign_id as string,
    adset_map: adsetMap,
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

// ── Asset fetch helper ────────────────────────────────────────────────────
//
// Pulls an image (or eventually video) referenced in sprint_creatives.image_url
// down into a Blob so we can POST it to Meta's ad image library. Supports:
//   - http(s):// URLs   — standard fetch
//   - data:...;base64   — decoded inline (used for client-side previews)
//
// Caps the result at 10 MB so a malicious or runaway upload can't pin the
// orchestrator. Meta's image upload limit is 30 MB but our LP banners come
// out to ~1–2 MB; 10 MB is comfortable headroom.

const MAX_ASSET_BYTES = 10 * 1024 * 1024;

async function fetchAsBlob(src: string): Promise<Blob> {
  if (src.startsWith('data:')) {
    // Form: data:image/jpeg;base64,XXXXXX...
    const comma = src.indexOf(',');
    if (comma < 0) throw new Error('fetchAsBlob: malformed data URL');
    const meta = src.slice(5, comma); // image/jpeg;base64
    const data = src.slice(comma + 1);
    const isBase64 = /;base64$/i.test(meta);
    const mime = meta.replace(/;base64$/i, '') || 'application/octet-stream';
    const buf = isBase64
      ? Buffer.from(data, 'base64')
      : Buffer.from(decodeURIComponent(data), 'utf-8');
    if (buf.byteLength > MAX_ASSET_BYTES) {
      throw new Error(`fetchAsBlob: asset exceeds ${MAX_ASSET_BYTES} bytes`);
    }
    return new Blob([buf], { type: mime });
  }

  const res = await fetch(src);
  if (!res.ok) {
    throw new Error(`fetchAsBlob: ${res.status} fetching ${src}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_ASSET_BYTES) {
    throw new Error(`fetchAsBlob: asset exceeds ${MAX_ASSET_BYTES} bytes`);
  }
  const mime = res.headers.get('content-type') ?? 'image/jpeg';
  return new Blob([buf], { type: mime });
}

// ── Main launcher ──────────────────────────────────────────────────────────

export async function launchManagedMetaCampaign(
  input: LaunchCampaignInput
): Promise<LaunchCampaignResult> {
  const { sprintId, idea, angles, landing, totalBudgetCents } = input;
  const requireApproved = input.requireApprovedCreatives ?? true;
  const autoActivate = input.autoActivate ?? !requireApproved; // gated by default

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

  // 0b. v10 approval gate — load user-approved creatives keyed by angle_id.
  // When requireApproved=true and the map is empty we refuse to launch so
  // we never push unreviewed creatives to Meta.
  const approvedRows = requireApproved
    ? await getDeployableCreatives(sprintId, 'meta')
    : [];
  const approvedByAngle: Record<string, SprintCreative> = {};
  for (const row of approvedRows) approvedByAngle[row.angle_id] = row;

  if (requireApproved && approvedRows.length === 0) {
    throw new Error(
      'launchManagedMetaCampaign: no approved sprint_creatives found for channel=meta. ' +
        'User must approve at least one creative before deployment.'
    );
  }

  const accessToken = getSystemToken();
  const adAccountId = getSystemAdAccountId();
  const pageId = getSystemPageId();
  const pixelId = getSystemPixelId();
  const baseUrl = input.baseUrl ?? process.env.BASE_URL ?? 'https://launchlense.com';

  // Resolve geo targeting once for the whole campaign. User-supplied
  // countries win; otherwise fall back to env default → 'US'. We sanitise
  // here so the downstream adset payload can trust the shape.
  const targetCountries = (() => {
    const raw =
      input.targeting?.countries?.length
        ? input.targeting.countries
        : (process.env.META_DEFAULT_COUNTRIES ?? 'US').split(',');
    const cleaned = raw
      .map((c) => c.trim().toUpperCase())
      .filter((c) => /^[A-Z]{2}$/.test(c));
    return cleaned.length ? cleaned : ['US'];
  })();

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
    // When requireApproved=true we only deploy angles with an approved
    // sprint_creatives row; otherwise we deploy every angle (legacy path).
    const anglesToDeploy = requireApproved
      ? angles.angles.filter((a) => approvedByAngle[a.id])
      : angles.angles;

    if (requireApproved && anglesToDeploy.length === 0) {
      throw new Error(
        'launchManagedMetaCampaign: filtered angle set is empty after approval check.'
      );
    }

    for (const angle of anglesToDeploy) {
      const approved = approvedByAngle[angle.id];
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
          // Meta v20+ rejects adsets with no geo and no custom audience
          // ("Location is missing", error_subcode 1885364). Pulled from the
          // resolved targeting on the LaunchCampaignInput (which itself
          // falls back to META_DEFAULT_COUNTRIES → 'US').
          geo_locations: { countries: targetCountries },
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

      // Mark the sprint_creatives row as 'deploying' so the UI reflects
      // in-flight state. Non-fatal — legacy path (no row) skips silently.
      if (approved) {
        try {
          await transitionStatus(sprintId, angle.id, 'meta', 'deploying', {
            actor: 'system',
          });
        } catch {/* swallow — status update is advisory */}
      }

      // Resolve the creative content: prefer the user-edited row, fall back
      // to the raw AngleAgent output. Never deploy partial copy.
      const rawCopy = angle.copy.meta;
      const message = approved?.primary_text?.trim() || rawCopy.body;
      const headline = approved?.headline?.trim() || rawCopy.headline;
      const description = approved?.description?.trim() ?? null;
      const ctaType = (approved?.cta?.trim() || 'LEARN_MORE').toUpperCase();

      // Upload the asset(s) to Meta's libraries and capture refs. Both
      // image_hash and video_id are idempotent at the sprint_creatives
      // level — we cache them so retries skip the upload.
      // Asset precedence: video_url wins over image_url (video ads use
      // video_data, with image_url as the still thumbnail when present).
      let imageHash: string | null = approved?.image_hash ?? null;
      let videoId: string | null = approved?.video_id ?? null;

      if (approved?.video_url && !videoId) {
        try {
          const blob = await fetchAsBlob(approved.video_url);
          const uploaded = await withMetaRetry(
            () => createAdVideo(adAccountId, accessToken, blob, `${angle.id}.mp4`),
            { label: `upload-video:${angle.id}` }
          );
          videoId = uploaded.video_id;
          try {
            await setMetaAssetRefs(sprintId, angle.id, 'meta', {
              video_id: videoId,
            });
          } catch {/* non-fatal */}
        } catch (err) {
          console.warn(
            `[create-campaign] video upload failed for ${angle.id}:`,
            err instanceof Error ? err.message : err
          );
        }
      }

      if (approved?.image_url && !imageHash) {
        try {
          const blob = await fetchAsBlob(approved.image_url);
          const uploaded = await withMetaRetry(
            () => createAdImage(adAccountId, accessToken, blob, `${angle.id}.jpg`),
            { label: `upload-image:${angle.id}` }
          );
          imageHash = uploaded.image_hash;
          try {
            await setMetaAssetRefs(sprintId, angle.id, 'meta', {
              image_hash: imageHash,
            });
          } catch {/* non-fatal */}
        } catch (err) {
          // If image upload fails we still deploy the creative without an image
          // rather than blocking the entire sprint. Meta will accept link-only
          // ads and the canvas will surface the upload error separately.
          console.warn(
            `[create-campaign] image upload failed for ${angle.id}:`,
            err instanceof Error ? err.message : err
          );
        }
      }

      // Build object_story_spec depending on whether we have a video or
      // an image. Video ads use video_data; image / link ads use link_data.
      const objectStorySpec: Record<string, unknown> = { page_id: pageId };
      if (videoId) {
        const videoData: Record<string, unknown> = {
          video_id: videoId,
          title: headline,
          message,
          call_to_action: {
            type: ctaType,
            value: { link: lpUrl },
          },
        };
        // Video creatives still want a poster frame; reuse the image hash if
        // we successfully uploaded one above.
        if (imageHash) videoData.image_hash = imageHash;
        if (description) videoData.link_description = description;
        objectStorySpec.video_data = videoData;
      } else {
        const linkData: Record<string, unknown> = {
          message,
          link: lpUrl,
          name: headline,
          call_to_action: { type: ctaType },
        };
        if (description) linkData.description = description;
        if (imageHash) linkData.image_hash = imageHash;
        objectStorySpec.link_data = linkData;
      }

      const creativeRes = (await withMetaRetry(
        () =>
          createAdCreative(adAccountId, accessToken, {
            name: `Creative — ${adsetName}`,
            object_story_spec: objectStorySpec,
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
        status: autoActivate ? 'ACTIVE' : 'PAUSED',
      });

      // Persist Meta refs back to sprint_creatives so the UI can reflect
      // 'deployed' state and the verdict / monitor jobs can find them.
      if (approved) {
        try {
          await setMetaCreativeRefs(sprintId, angle.id, 'meta', {
            creative_id: creativeRes.id,
            ad_id: adRes.id,
            adset_id: adsetRes.id,
          });
          await transitionStatus(sprintId, angle.id, 'meta', 'deployed', {
            actor: 'system',
          });
        } catch {/* non-fatal */}
      }
    }

    // 3. Activation gate.
    //   - Legacy / autoActivate=true: activate campaign + adsets immediately.
    //   - v10 default (autoActivate=false): leave everything PAUSED. The
    //     /api/sprint/[id]/campaign/activate endpoint flips them to ACTIVE
    //     after the user presses Launch in the canvas.
    if (autoActivate) {
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
    }

    const result = { campaignId, adsetMap, adMap, dailyBudgetCents };
    await persistCampaign(
      sprintId,
      result,
      adRows,
      totalBudgetCents,
      autoActivate ? 'ACTIVE' : 'PAUSED'
    );

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
