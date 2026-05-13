const META_API_VERSION = 'v20.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

type MetaResponse<T = Record<string, unknown>> = T & {
  error?: { message: string; type: string; code: number };
};

export class MetaAPIError extends Error {
  code: number;
  type: string;
  constructor(msg: string, code: number, type: string) {
    super(msg);
    this.name = 'MetaAPIError';
    this.code = code;
    this.type = type;
  }
}

async function metaFetch<T = Record<string, unknown>>(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const url = new URL(`${META_BASE}${path}`);

  // Always include access_token in URL for GET/DELETE requests
  // For POST requests we embed it in the form body instead
  const isPost = options.method === 'POST';

  if (!isPost) {
    url.searchParams.set('access_token', accessToken);
  }

  let finalOptions: RequestInit = { ...options };

  if (isPost && options.body) {
    // Meta Marketing API requires application/x-www-form-urlencoded for POST
    const parsed = JSON.parse(options.body as string) as Record<string, unknown>;
    const formData = new URLSearchParams();
    formData.set('access_token', accessToken);
    for (const [key, value] of Object.entries(parsed)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        if (value.length === 0) {
          // Meta accepts an empty JSON array string for fields like special_ad_categories
          formData.set(key, '[]');
        } else {
          // Send each array element as key[0]=..., key[1]=... or as JSON string
          // Meta Marketing API accepts JSON-encoded arrays as a single param
          formData.set(key, JSON.stringify(value));
        }
      } else if (typeof value === 'object') {
        formData.set(key, JSON.stringify(value));
      } else {
        formData.set(key, String(value));
      }
    }
    const bodyStr = formData.toString();
    console.log(`[metaFetch] POST ${path} body:`, bodyStr);
    finalOptions = {
      ...options,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyStr,
    };
  } else if (!isPost) {
    finalOptions = {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    };
  }

  const res = await fetch(url.toString(), finalOptions);

  const data: MetaResponse<T> = await res.json();

  if (data.error) {
    console.error(`[metaFetch] Meta error on ${path}:`, JSON.stringify(data.error));
    throw new MetaAPIError(
      data.error.message,
      data.error.code,
      data.error.type
    );
  }

  return data;
}

// Fetch ad account details for Healthgate
// Only request fields valid for the Marketing API (including Sandbox)
export async function fetchAdAccountHealth(
  accountId: string,
  accessToken: string
) {
  const fields = [
    'account_status',
    'balance',
    'spend_cap',
    'amount_spent',
    'adspixels{last_fired_time}',
    'funding_source_details',
    'disable_reason',
    'name',
    'currency',
    'business',
  ].join(',');

  return metaFetch(`/act_${accountId}?fields=${fields}`, accessToken);
}

// Create campaign
export async function createCampaign(
  accountId: string,
  accessToken: string,
  params: {
    name: string;
    objective: string;
    status: string;
    special_ad_categories: string[];
    is_adset_budget_sharing_enabled?: boolean;
  }
) {
  return metaFetch(`/act_${accountId}/campaigns`, accessToken, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// Create ad set
export async function createAdSet(
  accountId: string,
  accessToken: string,
  params: Record<string, unknown>
) {
  return metaFetch(`/act_${accountId}/adsets`, accessToken, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── Asset uploads (v10 editable creative workflow) ────────────────────────
// Per Meta docs, image uploads use multipart/form-data with the file under
// any key (Meta returns the hash keyed by that filename in `images`). Videos
// use a similar multipart form but the response includes a numeric `id`
// (video_id). Both must bypass our urlencoded helper because they need a
// raw file body, so they call fetch() directly.

export interface CreateAdImageResult {
  image_hash: string;
  url?: string;
}

/**
 * Upload an image to the ad account's image library.
 * Returns the image_hash to embed in object_story_spec.link_data.
 *
 * Reference: https://developers.facebook.com/docs/marketing-api/reference/ad-image
 */
export async function createAdImage(
  accountId: string,
  accessToken: string,
  file: Blob,
  filename = 'creative.jpg'
): Promise<CreateAdImageResult> {
  const url = new URL(`${META_BASE}/act_${accountId}/adimages`);
  const form = new FormData();
  form.set('access_token', accessToken);
  form.set('filename', file, filename);

  const res = await fetch(url.toString(), { method: 'POST', body: form });
  const data = (await res.json()) as MetaResponse<{
    images?: Record<string, { hash: string; url?: string }>;
  }>;

  if (data.error) {
    console.error('[createAdImage] Meta error:', JSON.stringify(data.error));
    throw new MetaAPIError(data.error.message, data.error.code, data.error.type);
  }

  // Meta keys the response by filename. There is exactly one entry.
  const first = data.images ? Object.values(data.images)[0] : undefined;
  if (!first?.hash) {
    throw new MetaAPIError('createAdImage: no hash returned', 0, 'Unknown');
  }
  return { image_hash: first.hash, url: first.url };
}

export interface CreateAdVideoResult {
  video_id: string;
}

/**
 * Upload a video to the ad account's video library.
 * Returns the video_id to embed in object_story_spec.video_data.
 *
 * For files ≤ 1GB we use the single-request endpoint. Larger files require
 * the chunked Resumable Upload API which we will add when we wire video.
 *
 * Reference: https://developers.facebook.com/docs/marketing-api/reference/video
 */
export async function createAdVideo(
  accountId: string,
  accessToken: string,
  file: Blob,
  filename = 'creative.mp4'
): Promise<CreateAdVideoResult> {
  const url = new URL(`${META_BASE}/act_${accountId}/advideos`);
  const form = new FormData();
  form.set('access_token', accessToken);
  form.set('source', file, filename);

  const res = await fetch(url.toString(), { method: 'POST', body: form });
  const data = (await res.json()) as MetaResponse<{ id?: string }>;

  if (data.error) {
    console.error('[createAdVideo] Meta error:', JSON.stringify(data.error));
    throw new MetaAPIError(data.error.message, data.error.code, data.error.type);
  }
  if (!data.id) {
    throw new MetaAPIError('createAdVideo: no id returned', 0, 'Unknown');
  }
  return { video_id: data.id };
}

// Create ad creative
export async function createAdCreative(
  accountId: string,
  accessToken: string,
  params: Record<string, unknown>
) {
  return metaFetch(`/act_${accountId}/adcreatives`, accessToken, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// Create ad
export async function createAd(
  accountId: string,
  accessToken: string,
  params: Record<string, unknown>
) {
  return metaFetch(`/act_${accountId}/ads`, accessToken, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// Update campaign status
export async function updateCampaignStatus(
  campaignId: string,
  accessToken: string,
  status: 'ACTIVE' | 'PAUSED' | 'DELETED'
) {
  return metaFetch(`/${campaignId}`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

// Get campaign insights
export async function getCampaignInsights(
  campaignId: string,
  accessToken: string
) {
  return metaFetch(
    `/${campaignId}/insights?fields=impressions,clicks,spend,actions,ctr,cpc`,
    accessToken
  );
}

// Delete Meta object (for rollback)
export async function deleteMetaObject(
  objectId: string,
  accessToken: string
) {
  return metaFetch(`/${objectId}`, accessToken, { method: 'DELETE' });
}

// ── Managed account helpers ───────────────────────────────────────────────
// LaunchLense-owned system user token — never expose to client.

export function getSystemToken(): string {
  const token = process.env.SYSTEM_META_ACCESS_TOKEN;
  if (!token) throw new Error('SYSTEM_META_ACCESS_TOKEN not configured');
  return token;
}

export function getSystemAdAccountId(): string {
  const id = process.env.SYSTEM_META_AD_ACCOUNT_ID;
  if (!id) throw new Error('SYSTEM_META_AD_ACCOUNT_ID not configured');
  return id;
}

export function getSystemPageId(): string {
  const id = process.env.SYSTEM_META_PAGE_ID;
  if (!id) throw new Error('SYSTEM_META_PAGE_ID not configured');
  return id;
}

export function getSystemPixelId(): string {
  const id = process.env.SYSTEM_META_PIXEL_ID ?? '';
  return id;
}

// ── Adset-level insights ──────────────────────────────────────────────────

export interface AdsetInsights {
  adset_id: string;
  adset_name: string;
  impressions: number;
  clicks: number;
  ctr: number;              // decimal (0.01 = 1%)
  cpc_cents: number;        // cost per click in USD cents
  spend_cents: number;      // total spend in USD cents
  actions: Record<string, number>; // e.g. { lead: 2, link_click: 15 }
  date_start: string;
  date_stop: string;
}

export async function getAdsetInsights(
  adsetId: string,
  accessToken: string,
  dateRange?: { since: string; until: string }
): Promise<AdsetInsights | null> {
  try {
    const fields = 'adset_id,adset_name,impressions,clicks,ctr,cpc,spend,actions';
    const timeRange = dateRange
      ? `&time_range={"since":"${dateRange.since}","until":"${dateRange.until}"}`
      : '';
    const raw = await metaFetch<{
      data?: Array<{
        adset_id: string;
        adset_name: string;
        impressions?: string;
        clicks?: string;
        ctr?: string;
        cpc?: string;
        spend?: string;
        actions?: Array<{ action_type: string; value: string }>;
        date_start: string;
        date_stop: string;
      }>;
    }>(
      `/${adsetId}/insights?fields=${fields}${timeRange}&level=adset`,
      accessToken
    );

    const row = raw.data?.[0];
    if (!row) return null;

    const actions: Record<string, number> = {};
    for (const a of row.actions ?? []) {
      actions[a.action_type] = parseFloat(a.value);
    }

    const spendUsd = parseFloat(row.spend ?? '0');
    const clicks = parseInt(row.clicks ?? '0', 10);
    const impressions = parseInt(row.impressions ?? '0', 10);
    const cpc = parseFloat(row.cpc ?? '0');

    return {
      adset_id: row.adset_id ?? adsetId,
      adset_name: row.adset_name ?? '',
      impressions,
      clicks,
      ctr: parseFloat(row.ctr ?? '0') / 100,  // Meta returns ctr as percent string
      cpc_cents: Math.round(cpc * 100),
      spend_cents: Math.round(spendUsd * 100),
      actions,
      date_start: row.date_start ?? '',
      date_stop: row.date_stop ?? '',
    };
  } catch (err) {
    console.error(`[getAdsetInsights] adset ${adsetId}:`, err);
    return null;
  }
}

export async function getMultiAdsetInsights(
  adsetIds: string[],
  accessToken: string,
  dateRange?: { since: string; until: string }
): Promise<AdsetInsights[]> {
  const results = await Promise.allSettled(
    adsetIds.map((id) => getAdsetInsights(id, accessToken, dateRange))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<AdsetInsights> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);
}

// ── Budget reallocation ───────────────────────────────────────────────────

/** Update the daily budget cap for an adset (in USD cents). */
export async function updateAdsetDailyBudget(
  adsetId: string,
  accessToken: string,
  dailyBudgetCents: number
): Promise<void> {
  await metaFetch(`/${adsetId}`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ daily_budget: dailyBudgetCents }),
  });
}

/** Pause a specific adset — used to stop underperforming angles. */
export async function pauseAdset(adsetId: string, accessToken: string): Promise<void> {
  await metaFetch(`/${adsetId}`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ status: 'PAUSED' }),
  });
}

/** Activate a paused adset. */
export async function activateAdset(adsetId: string, accessToken: string): Promise<void> {
  await metaFetch(`/${adsetId}`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ status: 'ACTIVE' }),
  });
}

// ── Full per-angle metrics fetch for a sprint campaign ────────────────────

export interface AngleCampaignMetrics {
  angle_id: 'angle_A' | 'angle_B' | 'angle_C';
  adset_id: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc_cents: number;
  spend_cents: number;
  leads: number;
  status: 'ACTIVE' | 'PAUSED' | 'UNDERPERFORM';
}

/** Decision thresholds — tune these as signal data accumulates. */
const CTR_PAUSE_THRESHOLD = 0.003;          // pause if CTR < 0.3% after 500 impressions
const IMPRESSION_MIN_FOR_PAUSE = 500;        // don't pause before minimum exposure

export async function fetchAndEvaluateAngles(
  angleAdsetMap: Record<'angle_A' | 'angle_B' | 'angle_C', string>,
  accessToken: string,
  autoActions = false
): Promise<AngleCampaignMetrics[]> {
  const ids = Object.entries(angleAdsetMap) as [
    'angle_A' | 'angle_B' | 'angle_C',
    string,
  ][];
  const insights = await getMultiAdsetInsights(ids.map(([, id]) => id), accessToken);
  const insightMap = new Map(insights.map((i) => [i.adset_id, i]));

  const results: AngleCampaignMetrics[] = [];

  for (const [angleId, adsetId] of ids) {
    const insight = insightMap.get(adsetId);
    const impressions = insight?.impressions ?? 0;
    const clicks = insight?.clicks ?? 0;
    const ctr = insight?.ctr ?? 0;
    const cpc_cents = insight?.cpc_cents ?? 0;
    const spend_cents = insight?.spend_cents ?? 0;
    const leads = insight?.actions['lead'] ?? insight?.actions['offsite_conversion.lead'] ?? 0;

    let status: AngleCampaignMetrics['status'] = 'ACTIVE';
    if (impressions >= IMPRESSION_MIN_FOR_PAUSE && ctr < CTR_PAUSE_THRESHOLD) {
      status = 'UNDERPERFORM';
      if (autoActions) {
        try {
          await pauseAdset(adsetId, accessToken);
          console.log(`[meta] Paused underperforming adset ${adsetId} (CTR ${(ctr * 100).toFixed(2)}%)`);
        } catch (err) {
          console.warn(`[meta] Failed to pause adset ${adsetId}:`, err);
        }
      }
    }

    results.push({ angle_id: angleId, adset_id: adsetId, impressions, clicks, ctr, cpc_cents, spend_cents, leads, status });
  }

  return results;
}
