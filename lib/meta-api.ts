// Meta Marketing API wrapper
// Respects ADS_API_MODE=sandbox|production

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
  if (!options.method || options.method === 'GET') {
    url.searchParams.set('access_token', accessToken);
  }

  const res = await fetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data: MetaResponse<T> = await res.json();

  if (data.error) {
    throw new MetaAPIError(
      data.error.message,
      data.error.code,
      data.error.type
    );
  }

  return data;
}

// Fetch ad account details for Healthgate
export async function fetchAdAccountHealth(
  accountId: string,
  accessToken: string
) {
  const fields = [
    'account_status',
    'balance',
    'spend_cap',
    'amount_spent',
    'ads_volume',
    'has_advertiser_access',
    'adspixels{last_fired_time}',
    'funding_source_details',
    'agency_client_declaration',
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

// Upload ad image
export async function uploadAdImage(
  accountId: string,
  accessToken: string,
  imageUrl: string
) {
  return metaFetch(`/act_${accountId}/adimages`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ url: imageUrl }),
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
