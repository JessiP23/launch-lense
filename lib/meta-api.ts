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
