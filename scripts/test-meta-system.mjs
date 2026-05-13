const API = 'https://graph.facebook.com/v20.0';
const args = new Set(process.argv.slice(2));
const insightsArg = process.argv.slice(2).find((a) => a.startsWith('--insights='));
const DO_CREATE = args.has('--create');
const DO_CLEANUP = args.has('--cleanup');
const DO_INSIGHTS = !!insightsArg;
const INSIGHTS_ID = insightsArg?.split('=')[1];

const TOKEN = process.env.SYSTEM_META_ACCESS_TOKEN;
let AD_ACCOUNT = process.env.SYSTEM_META_AD_ACCOUNT_ID;
const ACT = AD_ACCOUNT;
const PAGE_ID = process.env.SYSTEM_META_PAGE_ID;
const PIXEL_ID = process.env.SYSTEM_META_PIXEL_ID;

// ── tiny color helpers ──────────────────────────────────────────────────────
const c = (code, s) => `\x1b[${code}m${s}\x1b[0m`;
const ok = (s) => console.log(c(32, '✓'), s);
const warn = (s) => console.log(c(33, '!'), s);
const fail = (s) => console.log(c(31, '✗'), s);
const head = (s) => console.log('\n' + c(36, `── ${s} ──`));

// ── fetch wrapper ───────────────────────────────────────────────────────────
async function mget(path, params = {}) {
  const url = new URL(`${API}${path}`);
  url.searchParams.set('access_token', TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(`GET ${path} → [${json.error.code}] ${json.error.message}`);
  return json;
}
async function mpost(path, params = {}) {
  const url = new URL(`${API}${path}`);
  const body = new URLSearchParams();
  body.set('access_token', TOKEN);
  for (const [k, v] of Object.entries(params)) {
    body.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await res.json();
  if (json.error) throw new Error(`POST ${path} → [${json.error.code}] ${json.error.message}`);
  return json;
}
async function mdelete(path) {
  const url = new URL(`${API}${path}`);
  url.searchParams.set('access_token', TOKEN);
  const res = await fetch(url, { method: 'DELETE' });
  const json = await res.json();
  if (json.error) throw new Error(`DELETE ${path} → [${json.error.code}] ${json.error.message}`);
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(c(35, '\nLaunchLense — Meta system credential smoke test'));
  console.log(c(90, `Mode: ${DO_CREATE ? 'CREATE' : 'read-only'} ${DO_CLEANUP ? '+ cleanup' : ''}`));

  // ── 0. Sanity-check env ────────────────────────────────────────────────
  head('0. Environment');
  if (!TOKEN) {
    fail('No access token (SYSTEM_META_ACCESS_TOKEN or AD_ACCESS_TOKEN)');
    process.exit(1);
  }
  ok(`Token loaded (${TOKEN.slice(0, 8)}…${TOKEN.slice(-4)})`);
  if (!AD_ACCOUNT) {
    fail('No ad account (SYSTEM_META_AD_ACCOUNT_ID or AD_ACCOUNT_ID)');
    process.exit(1);
  }
  ok(`Ad account: ${ACT}`);
  PAGE_ID ? ok(`Page ID: ${PAGE_ID}`) : warn('SYSTEM_META_PAGE_ID not set (required for --create)');
  PIXEL_ID ? ok(`Pixel ID: ${PIXEL_ID}`) : warn('SYSTEM_META_PIXEL_ID not set (optional but recommended)');

  // ── 1. Token introspection ─────────────────────────────────────────────
  head('1. Token identity');
  const me = await mget('/me', { fields: 'id,name' });
  ok(`Authenticated as: ${me.name ?? '(system user)'} [id=${me.id}]`);

  const debug = await mget('/debug_token', { input_token: TOKEN });
  const d = debug.data ?? {};
  ok(`Token type: ${d.type ?? 'unknown'}`);
  ok(`App ID: ${d.app_id ?? 'unknown'}`);
  ok(`Valid: ${d.is_valid}`);
  if (d.expires_at === 0 || !d.expires_at) ok('Expiry: never (long-lived system user token) ✨');
  else ok(`Expires: ${new Date(d.expires_at * 1000).toISOString()}`);
  if (d.scopes?.length) ok(`Scopes: ${d.scopes.join(', ')}`);

  const requiredScopes = ['ads_management', 'ads_read', 'business_management'];
  const missingScopes = requiredScopes.filter((s) => !(d.scopes ?? []).includes(s));
  if (missingScopes.length) warn(`Missing recommended scopes: ${missingScopes.join(', ')}`);

  // ── 2. Ad account access ───────────────────────────────────────────────
  head('2. Ad account');
  const acct = await mget(`/${ACT}`, {
    fields: 'id,name,account_status,currency,timezone_name,disable_reason,spend_cap,balance,amount_spent',
  });
  ok(`Name: ${acct.name}`);
  const statusMap = {
    1: 'ACTIVE',
    2: 'DISABLED',
    3: 'UNSETTLED',
    7: 'PENDING_RISK_REVIEW',
    8: 'PENDING_SETTLEMENT',
    9: 'IN_GRACE_PERIOD',
    100: 'PENDING_CLOSURE',
    101: 'CLOSED',
    201: 'ANY_ACTIVE',
    202: 'ANY_CLOSED',
  };
  const statusLabel = statusMap[acct.account_status] ?? `unknown (${acct.account_status})`;
  if (acct.account_status === 1) ok(`Status: ${statusLabel}`);
  else fail(`Status: ${statusLabel}`);
  ok(`Currency: ${acct.currency}, Timezone: ${acct.timezone_name}`);
  ok(`Balance: ${(acct.balance ?? 0) / 100} ${acct.currency} · Spent: ${(acct.amount_spent ?? 0) / 100} ${acct.currency}`);

  // ── 3. Pages this token can act on ─────────────────────────────────────
  head('3. Pages this token can use');
  try {
    const pages = await mget('/me/accounts', { fields: 'id,name,access_token,tasks', limit: 25 });
    if (!pages.data?.length) warn('No pages accessible (System Users can be assigned pages in Business Manager)');
    for (const p of pages.data ?? []) {
      const tasks = (p.tasks ?? []).join(',');
      const marker = p.id === PAGE_ID ? c(32, ' ← SYSTEM_META_PAGE_ID') : '';
      console.log(`   • ${p.id}  ${p.name}  [${tasks}]${marker}`);
    }
  } catch (e) {
    warn(`Could not enumerate pages: ${e.message}`);
  }

  // ── 4. Pixels on this ad account ───────────────────────────────────────
  head('4. Pixels on this ad account');
  try {
    const pixels = await mget(`/${ACT}/adspixels`, { fields: 'id,name,code,last_fired_time' });
    if (!pixels.data?.length) warn('No pixels found on this ad account');
    for (const px of pixels.data ?? []) {
      const marker = px.id === PIXEL_ID ? c(32, ' ← SYSTEM_META_PIXEL_ID') : '';
      console.log(`   • ${px.id}  ${px.name}  last_fired=${px.last_fired_time ?? 'never'}${marker}`);
    }
  } catch (e) {
    warn(`Could not enumerate pixels: ${e.message}`);
  }

  // ── 5. Existing campaigns (read-only) ──────────────────────────────────
  head('5. Recent campaigns on this account');
  try {
    const camps = await mget(`/${ACT}/campaigns`, {
      fields: 'id,name,status,effective_status,objective,created_time',
      limit: 5,
    });
    if (!camps.data?.length) warn('No existing campaigns');
    for (const k of camps.data ?? []) {
      console.log(`   • ${k.id}  ${k.name.slice(0, 50)}  [${k.effective_status}]  ${k.objective}`);
    }
  } catch (e) {
    warn(`Could not list campaigns: ${e.message}`);
  }

  // ── 6. Insights for a specific ID (if --insights=...) ──────────────────
  if (DO_INSIGHTS && INSIGHTS_ID) {
    head(`6. Insights for ${INSIGHTS_ID}`);
    try {
      const ins = await mget(`/${INSIGHTS_ID}/insights`, {
        fields: 'impressions,clicks,ctr,cpc,cpm,spend,frequency,outbound_clicks,actions',
        date_preset: 'maximum',
      });
      console.log(JSON.stringify(ins.data?.[0] ?? {}, null, 2));
    } catch (e) {
      warn(`Insights failed: ${e.message}`);
    }
  }

  // ── 7. Optional: end-to-end create (PAUSED, dollar-safe) ──────────────
  if (!DO_CREATE) {
    console.log('\n' + c(90, 'Skipping campaign creation. Re-run with --create to test the full launch path.'));
    console.log(c(90, 'Re-run with --create --cleanup to immediately delete what is created.'));
    return;
  }

  head('7. End-to-end create (PAUSED — no spend)');
  if (!PAGE_ID) {
    fail('SYSTEM_META_PAGE_ID required for --create');
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const created = {};

  try {
    // 7a. Campaign
    const camp = await mpost(`/${ACT}/campaigns`, {
      name: `LL_SMOKE_${stamp}`,
      objective: 'OUTCOME_LEADS',
      status: 'PAUSED',
      special_ad_categories: [],
    });
    created.campaign_id = camp.id;
    ok(`Campaign created: ${camp.id}`);

    // 7b. AdSet — daily $5, paused
    const targeting = {
      age_min: 25,
      age_max: 55,
      geo_locations: { countries: ['US'] },
      publisher_platforms: ['facebook'],
      facebook_positions: ['feed'],
      device_platforms: ['mobile', 'desktop'],
    };
    const adsetParams = {
      name: `LL_SMOKE_${stamp}_adset`,
      campaign_id: camp.id,
      daily_budget: 500, // $5 in cents
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LEAD_GENERATION',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      destination_type: 'WEBSITE',
      status: 'PAUSED',
      targeting,
      start_time: new Date(Date.now() + 3600_000).toISOString(),
    };
    if (PIXEL_ID) {
      adsetParams.promoted_object = { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' };
    }
    const adset = await mpost(`/${ACT}/adsets`, adsetParams);
    created.adset_id = adset.id;
    ok(`AdSet created: ${adset.id}`);

    // 7c. Creative
    const creative = await mpost(`/${ACT}/adcreatives`, {
      name: `LL_SMOKE_${stamp}_creative`,
      object_story_spec: {
        page_id: PAGE_ID,
        link_data: {
          message: 'Validation test — please ignore.',
          link: 'https://launchlense.com',
          name: 'LaunchLense smoke test',
          call_to_action: { type: 'LEARN_MORE' },
        },
      },
    });
    created.creative_id = creative.id;
    ok(`Creative created: ${creative.id}`);

    // 7d. Ad
    const ad = await mpost(`/${ACT}/ads`, {
      name: `LL_SMOKE_${stamp}_ad`,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: 'PAUSED',
      tracking_specs: PIXEL_ID ? [{ action: ['offsite_conversions'], pixel: [PIXEL_ID] }] : [],
    });
    created.ad_id = ad.id;
    ok(`Ad created: ${ad.id}`);

    console.log('\n' + c(32, 'SUCCESS — full ad object hierarchy created.'));
    console.log(c(90, JSON.stringify(created, null, 2)));
  } catch (e) {
    fail(`Create failed: ${e.message}`);
    console.log(c(90, 'Created so far: ' + JSON.stringify(created, null, 2)));
  }

  // ── 8. Cleanup ─────────────────────────────────────────────────────────
  if (DO_CLEANUP) {
    head('8. Cleanup');
    for (const [k, id] of Object.entries(created).reverse()) {
      try {
        await mdelete(`/${id}`);
        ok(`Deleted ${k} ${id}`);
      } catch (e) {
        warn(`Could not delete ${k} ${id}: ${e.message}`);
      }
    }
  } else {
    console.log('\n' + c(33, '! Created objects are PAUSED but still present.'));
    console.log(c(90, '  Re-run with --create --cleanup, or delete via Ads Manager.'));
  }
}

main().catch((e) => {
  fail(`Fatal: ${e.message}`);
  process.exit(1);
});
