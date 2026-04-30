export interface SerperData {
  organic_result_count: number;    // total Google-indexed pages for this query
  google_ads_count: number;        // advertisers actively buying this keyword on Google right now
  related_searches: string[];      // what buyers actually type (from Google autocomplete)
  top_titles: string[];            // first 5 organic page titles
  top_snippet: string;             // first organic result snippet
  knowledge_graph_title?: string;  // if Google shows a KG card (signals established category)
}

export interface MetaAdLibraryData {
  active_ads_count: number;        // active Meta/IG ads matching search terms (capped at 25 by API)
  advertiser_names: string[];      // actual brand names running these ads
  error?: string;                  // surface to UI if API fails
}

export interface RealMarketData {
  query: string;
  serper: SerperData | null;
  meta_ads: MetaAdLibraryData | null;
  fetched_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SerpAPI — Google Search (serpapi.com)
// GET https://serpapi.com/search?engine=google&q=...&api_key=...
// Free tier: 100 searches/month. Paid plans available at serpapi.com
// Key env var: SERPER_API_KEY (reusing same name to avoid .env changes)
// ─────────────────────────────────────────────────────────────────────────────

const SERPAPI_TIMEOUT_MS = 22_000;

async function fetchGoogleDataOnce(query: string, apiKey: string): Promise<SerperData> {
  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    gl: 'us',
    hl: 'en',
    num: '10',
    api_key: apiKey,
  });

  const res = await fetch(`https://serpapi.com/search?${params.toString()}`, {
    method: 'GET',
    signal: AbortSignal.timeout(SERPAPI_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SerpAPI HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    search_information?: { total_results?: number };
    ads?: unknown[];
    organic_results?: Array<{ title: string; snippet?: string }>;
    related_searches?: Array<{ query: string }>;
    knowledge_graph?: { title?: string };
  };

  const related = (data.related_searches ?? [])
    .map((r) => r.query)
    .filter((q) => q.toLowerCase() !== query.toLowerCase())
    .slice(0, 4);

  return {
    organic_result_count: data.search_information?.total_results ?? 0,
    google_ads_count: data.ads?.length ?? 0,
    related_searches: related,
    top_titles: (data.organic_results ?? []).slice(0, 5).map((r) => r.title),
    top_snippet: data.organic_results?.[0]?.snippet ?? '',
    knowledge_graph_title: data.knowledge_graph?.title,
  };
}

export async function fetchGoogleData(query: string): Promise<SerperData | null> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.warn('[market-research] SERPER_API_KEY not set — skipping Google data');
    return null;
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fetchGoogleDataOnce(query, apiKey);
    } catch (err) {
      const isTimeout =
        err instanceof Error &&
        (err.name === 'TimeoutError' ||
          err.message.includes('timeout') ||
          ('code' in err && (err as NodeJS.ErrnoException).code === '23'));
      if (isTimeout && attempt < 2) {
        console.warn('[market-research] SerpAPI timeout — retrying once');
        continue;
      }
      console.error('[market-research] fetchGoogleData failed:', err);
      return null;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Meta Ad Library API — public, free
// Uses app access token: META_APP_ID|META_APP_SECRET (no user auth needed)
// Docs: https://developers.facebook.com/docs/graph-api/reference/ads_archive/
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchMetaAdLibrary(query: string): Promise<MetaAdLibraryData | null> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    console.warn('[market-research] META_APP_ID or META_APP_SECRET not set');
    return null;
  }

  const appToken = `${appId}|${appSecret}`;

  try {
    const params = new URLSearchParams({
      access_token: appToken,
      search_terms: query,
      ad_reached_countries: JSON.stringify(['US']),
      ad_active_status: 'ACTIVE',
      ad_delivery_date_min: getDateMonthsAgo(3), // last 3 months only
      limit: '25',
      fields: 'page_name,ad_creative_body,ad_snapshot_url',
    });

    const res = await fetch(
      `https://graph.facebook.com/v20.0/ads_archive?${params.toString()}`,
      { signal: AbortSignal.timeout(8000) }
    );

    const data = await res.json() as {
      data?: Array<{ page_name?: string }>;
      error?: { message: string };
      paging?: { cursors?: { after?: string } };
    };

    if (data.error) {
      return { active_ads_count: 0, advertiser_names: [], error: data.error.message };
    }

    const ads = data.data ?? [];
    const advertisers = [
      ...new Set(ads.map((a) => a.page_name).filter(Boolean) as string[]),
    ].slice(0, 8);

    return {
      active_ads_count: ads.length,
      advertiser_names: advertisers,
    };
  } catch (err) {
    console.error('[market-research] fetchMetaAdLibrary failed:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator — fetch both sources in parallel
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchRealMarketData(idea: string): Promise<RealMarketData> {
  // Extract the core search query from the idea (use first 60 chars, strip jargon)
  const query = idea.trim().slice(0, 80);

  const [serper, meta_ads] = await Promise.allSettled([
    fetchGoogleData(query),
    fetchMetaAdLibrary(query),
  ]);

  return {
    query,
    serper: serper.status === 'fulfilled' ? serper.value : null,
    meta_ads: meta_ads.status === 'fulfilled' ? meta_ads.value : null,
    fetched_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getDateMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split('T')[0];
}
