# LaunchLense — Agent Briefing Document
> Paste this entire file at the start of any new AI session to resume work with full context.
> Last updated: 2026-04-21 — v3.0 (Post-MVP Investor Growth Build)

---

## 1. What is LaunchLense?

**LaunchLense** is a SaaS platform that acts as *"ad account insurance for venture studios."* The core thesis: instead of spending $35K and 8 weeks building an MVP to validate a startup idea, founders can validate demand using a $500 Meta ad test in 48 hours.

The product:
1. **Healthgate™** — scores your Meta ad account (0–100) before allowing any test to run. If score < 60, launch is blocked. This prevents wasted spend on broken accounts.
2. **Test Creation** — AI-assisted flow that takes a business idea, generates creative angles (headline, primary_text, CTA), creates a landing page, deploys a real Meta campaign via the Marketing API, and tracks results.
3. **Verdict Engine** — after $500 spend or 48h, the system issues a GO / NO-GO / ITERATE verdict with a downloadable PDF report.
4. **BYOK (Bring Your Own Key)** — users connect their own Meta ad accounts via either OAuth (Facebook Login) or a manually pasted access token.

**Brand voice:** dark UI (#0A0A0A background, #FAFAFA text), minimal, data-dense, anti-hype. Think "Vercel meets ad tech."

**Target users:** Venture studios, early-stage founders, growth hackers.

---

## 2. Vision & Roadmap — Where We're Going

The long-term product is inspired by platforms like [Cascade](https://cascaded.ai/en/) — a unified multi-platform ad intelligence tool. LaunchLense's roadmap is:

### Phase 1: Meta MVP (CURRENT — ~80% complete)
- [x] Meta OAuth + BYOK account connection
- [x] Healthgate™ scoring engine
- [x] AI angle generation (Groq / llama-3.1-8b-instant)
- [x] Campaign creation via Meta Marketing API v20.0
- [x] Landing page builder (GrapesJS) + Vercel deploy
- [x] LP tracking pixel + event ingestion
- [x] Verdict engine + PDF report generation
- [x] Shareable report links
- [x] Daily cron jobs (health sync, metrics pull, verdict computation)
- [ ] Meta app Live mode (currently Dev mode blocks ad creative creation)
- [ ] Token Vault encryption (tokens stored raw — needs Supabase Vault)
- [ ] Missing Meta token scopes: `ads_read`, `business_management`, `pages_read_engagement`
- [ ] Deploy `/terms` page to production (exists in code, not yet deployed)

### Phase 2: Google Ads Integration (NEXT)
- Google OAuth 2.0 (Google Ads API)
- Healthgate checks for Google: billing active, policy violations, conversion tracking, quality score
- Campaign type: Search + Performance Max
- Angle generation adapted for search intent (keywords, headlines, descriptions)
- Google-specific Verdict: CTR > 2%, CPA < target

### Phase 3: TikTok Ads Integration
- TikTok for Business OAuth
- Creative-first: video script generation via LLM + hook score
- Healthgate: pixel active, business center verified, ad account standing
- TikTok-specific metrics: hook rate (3s view %), swipe-up rate

### Phase 4: LinkedIn Ads Integration
- LinkedIn Campaign Manager OAuth
- B2B focus: Lead Gen Forms, Sponsored Content
- ICP scoring: title targeting match, company size fit
- Higher CPA thresholds vs. consumer

### Phase 5: Unified Dashboard
- Cross-platform spend overview
- AI chat: "Why is our CTR dropping?" answered with data from all connected platforms
- Budget optimizer: AI recommends reallocation across platforms based on ROAS
- Unified PDF report across all platforms for a single idea

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 16.2.3** App Router (NOT Pages Router) |
| Language | **TypeScript** (strict) |
| Styling | **Tailwind CSS v4** + custom CSS variables |
| UI Components | **Radix UI** primitives + custom components in `/components/ui/` |
| Animation | **Framer Motion** |
| Database | **Supabase** (PostgreSQL) |
| Auth | **Clerk** (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY) |
| AI / LLM | **Groq** — `llama-3.1-8b-instant` via OpenAI-compatible API |
| Ad Platform | **Meta Marketing API v20.0** |
| PDF Generation | **@react-pdf/renderer** |
| LP Builder | **GrapesJS** (client-side canvas) |
| LP Deploy | **Vercel Blob** (HTML storage) |
| State | **Zustand** with localStorage persistence |
| Crons | **Vercel Cron Jobs** (Hobby plan: max 1/day) |
| Hosting | **Vercel** — `https://launch-lense.vercel.app` |

### Key environment variables
```
NEXT_PUBLIC_SUPABASE_URL=https://itbllrhwrmglpjsxikph.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
META_APP_ID=4411532059166723
META_APP_SECRET=90713ba1d570b80287d35697dfa7193b
META_WEBHOOK_VERIFY_TOKEN=launchlense_verify
META_PAGE_ID=1104494692741860
GROQ_API_KEY=gsk_...
NEXT_PUBLIC_APP_URL=https://launch-lense.vercel.app
CRON_SECRET=...

# Genome — live market signals (Google via SerpAPI; Meta Ad Library uses META_APP_ID / META_APP_SECRET above)
SERPER_API_KEY=...              # serpapi.com — enables organic counts, ads, related searches in GenomeAgent

# Google OAuth — Sheets (read) + Gmail (send) for post-sprint SpreadsheetAgent / OutreachAgent
# Create OAuth client: Google Cloud Console → APIs & Services → Credentials → Web application
# Authorized redirect URI: {NEXT_PUBLIC_APP_URL}/api/integrations/google/callback
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_STATE_SECRET=...   # long random string — signs OAuth state cookie/param
GOOGLE_OAUTH_SECRET=...         # openssl rand -base64 32 — AES key for encrypting refresh tokens at rest
```

**Google “Sign in with Google” for Sheets + Gmail (end users):** You register **one** OAuth client in Google Cloud (this app). **End users never** create their own Google Cloud project. They click **Connect Google** in LaunchLense, approve the consent screen once, and the server stores an **encrypted refresh token** keyed by **`org_id`** (or sprint when no org) — see `lib/google/sprint-scope.ts` and `google_oauth_tokens`. For production, add the deployed origin to **Authorized JavaScript origins** and the callback URL to **Authorized redirect URIs**, and ensure the OAuth consent screen is **Published** (or test users added) if using sensitive scopes. To give **each user** their own Gmail instead of one mailbox per org, extend the scope key to include **`user_id`** (and store tokens per user) — the current schema is org/sprint–scoped.

---

## 4. Project File Structure

```
/app
  layout.tsx                        — root layout, dark theme
  page.tsx                          — redirects to /landing or /dashboard
  landing/page.tsx                  — marketing landing page
  privacy/page.tsx                  — Meta App Review: privacy policy
  terms/page.tsx                    — Meta App Review: terms of service
  lp/[test_id]/route.ts             — serves deployed landing pages
  share/[token]/page.tsx            — public shareable test report

  (app)/                            — authenticated app shell
    accounts/
      page.tsx                      — list connected Meta ad accounts
      connect/page.tsx              — connect new account (OAuth or BYOK)
      [id]/page.tsx                 — account detail + health breakdown
    tests/
      page.tsx                      — list all tests
      new/
        page.tsx                    — test creation wizard (multi-step)
        actions.ts                  — server actions: createTest (Meta API calls)
      [id]/page.tsx                 — test detail + metrics
    editor/[test_id]/page.tsx       — GrapesJS LP editor

  api/
    auth/meta/
      start/route.ts                — initiates Meta OAuth (validates platform=meta)
      callback/route.ts             — Meta OAuth callback, saves token
    accounts/
      route.ts                      — GET /api/accounts (lists ad accounts)
      byok/route.ts                 — POST: validate + save manually pasted token
    ai/
      extract/route.ts              — POST: Groq angle extraction from URL/idea
    angle/
      generate/route.ts             — POST: Meta-specific angle generation
    health/
      sync/route.ts                 — GET: fetch Meta account health + compute score
                                       dev mock: ?account_id=act_XXX&mock=pass → score 95
    lp/
      deploy/route.ts               — POST: deploy LP HTML to Vercel Blob
      track/route.ts                — POST: ingest LP pixel events
    reports/[test_id]/route.ts      — GET PDF / GET JSON report
    webhooks/meta/route.ts          — Meta webhook endpoint (verify + receive)
    cron/
      health/route.ts               — daily health sync for all accounts
      metrics/route.ts              — daily metrics pull from Meta
      verdict/route.ts              — daily verdict computation

/lib
  meta-api.ts                       — ALL Meta Graph API calls
                                       CRITICAL: POST must use URLSearchParams (form-encoded)
                                       NOT JSON. Meta rejects JSON bodies.
  groq.ts                           — META_SYSTEM_PROMPT + Groq client config
  healthgate.ts                     — calculateHealthChecks(accountData) → {score, status, checks}
  supabase.ts                       — createServiceClient()
  supabase-admin.ts                 — supabaseAdmin (service role)
  store.ts                          — Zustand store (orgId, activeAccountId, healthSnapshot)

/components
  app-sidebar.tsx                   — nav sidebar with Healthgate ring
  app-header.tsx                    — top bar with search (Cmd+K)
  healthgate-ring.tsx               — circular score ring component
  status-dot.tsx                    — green/yellow/red status indicator
  ui/                               — Button, Card, Badge, Input, etc.

/supabase/migrations/
  001_schema.sql                    — full DB schema
```

---

## 5. Database Schema (Supabase)

```sql
organizations        — id, name, created_at
org_members          — org_id, user_id, role
ad_accounts          — id, org_id, platform ('meta'), account_id, access_token, name, last_checked_at
health_snapshots     — id, ad_account_id, score, status, checks (jsonb), created_at
tests                — id, org_id, ad_account_id, name, idea, status, verdict, lp_url, lp_json, lp_html,
                       meta_campaign_id, meta_adset_id, meta_ad_id, angles (jsonb), created_at
events               — id, test_id, event_type, payload (jsonb), ts
annotations          — id, test_id, author, message, created_at
share_tokens         — id, test_id, token, created_at
```

---

## 6. Core Business Logic

### Healthgate™ Score
`lib/healthgate.ts` computes a 0–100 score from these checks (each has a weight):
- `account_status === 1` (active) — CRITICAL
- `balance > 0` — HIGH
- `disapproved_90d < 3` — HIGH
- `pixel_active` — MEDIUM
- `funding_source` exists — HIGH
- `two_factor_enabled` — MEDIUM
- `domain_verified` — MEDIUM
- `page_quality > 0.5` — LOW
- `policy_issues === 0` — HIGH

Score < 60 = RED = launch blocked. 60–79 = YELLOW = warning. 80+ = GREEN = go.

### Meta API Critical Rules
1. **POST bodies MUST be `application/x-www-form-urlencoded`**, NOT JSON. `lib/meta-api.ts` uses `URLSearchParams`.
2. **Access token** embedded in POST body as `access_token` field.
3. **Campaign params** that work (do NOT change):
   - `billing_event: 'IMPRESSIONS'`
   - `optimization_goal: 'REACH'`
   - `bid_amount: 100`
   - `is_adset_budget_sharing_enabled: false`
4. **App must be in Live mode** in Meta developer console to create ad creatives (subcode 1885183 blocks creatives in Dev mode).

### LLM Rules
- All Groq calls MUST include `META_SYSTEM_PROMPT` as the system message (from `lib/groq.ts`)
- The system prompt rejects non-Meta platform questions
- Model: `llama-3.1-8b-instant`
- Angle constraints: headline ≤ 40 chars, primary_text ≤ 125 chars, CTA must be one of `LEARN_MORE | SHOP_NOW | SIGN_UP`

---

## 7. Current Bugs / Outstanding Work

### CRITICAL (blocks production)
| # | Issue | Location | Fix Needed |
|---|-------|----------|-----------|
| 1 | `access_token` stored as raw string in DB | `ad_accounts.access_token` | Migrate to Supabase Vault: store vault_id, resolve on read |
| 2 | Missing token scopes: `ads_read`, `business_management` | Meta token | Regenerate in Graph API Explorer with full scopes |
| 3 | Meta app in Dev mode — ad creatives blocked (subcode 1885183) | developers.facebook.com | Toggle App Mode → Live in Meta dashboard |
| 4 | `/terms` 404 on Vercel | `app/terms/page.tsx` | Push `new_property` branch to trigger Vercel deploy |

### MEDIUM
| # | Issue | Location | Fix Needed |
|---|-------|----------|-----------|
| 5 | PAGE_ID `1104494692741860` returns 403 with current token scope (code 10) | `app/(app)/tests/new/actions.ts` | Fix token scopes first, then re-validate |
| 6 | No `page_id` column in `ad_accounts` schema | `001_schema.sql` | Add migration if page_id needs to be per-account |

### DONE ✅
- BYOK 500 fixed (org_id FK, .maybeSingle())
- /api/accounts 500 fixed (removed non-existent columns)
- Meta POST encoding fixed
- Adset params working (IMPRESSIONS/REACH/bid_amount:100)
- Vercel crons fixed for Hobby plan (once-daily)
- NEXT_PUBLIC_APP_URL set to production
- Meta-only UI enforcement (no Google/TikTok/LinkedIn in UI)
- LLM locked to Meta context (META_SYSTEM_PROMPT)
- Healthgate dev mock gate (mock=pass in dev only)
- /privacy 200 ✅, webhook 200 ✅

---

## 8. Coding Conventions

1. **Next.js App Router only** — no `getServerSideProps`, no `pages/` directory. Use `export async function GET/POST` in `route.ts` files.
2. **Server Components by default** — add `'use client'` only when using hooks/browser APIs.
3. **Supabase admin** for server-side writes: `import { supabaseAdmin } from '@/lib/supabase-admin'`
4. **Meta API** always goes through `lib/meta-api.ts` — never call `fetch('https://graph.facebook.com/...')` directly in routes.
5. **No hardcoded UUIDs** in production code — always derive org_id from existing DB rows.
6. **Tailwind v4** — use CSS `@theme` variables in `globals.css`, not `tailwind.config.js`.
7. **Error handling** — all API routes return `Response.json({ error: '...' }, { status: NNN })` format.
8. **TypeScript strict** — no `any` unless absolutely necessary.
9. **Google/TikTok/LinkedIn grep rule** — ZERO occurrences of these platform names in `/app/**` (enforcement via CI). Add new platforms only through the proper Phase 2/3/4 integration pathway described in Section 2.
10. **Font rule** — no `next/font/google` import anywhere. Fonts are CSS variables in `globals.css`.

---

## 9. Adding a New Platform (Implementation Pattern)

When you're ready to add Google Ads, TikTok, or LinkedIn, follow this pattern:

### Step 1: DB migration
```sql
-- Add platform enum or just use text column (already text in schema)
-- Add platform-specific token columns if needed
ALTER TABLE ad_accounts ADD COLUMN google_customer_id text;
ALTER TABLE ad_accounts ADD COLUMN tiktok_advertiser_id text;
```

### Step 2: Platform API lib
Create `lib/google-ads-api.ts` (or `lib/tiktok-api.ts`) mirroring `lib/meta-api.ts`:
- `googleFetch(endpoint, options)` — handles OAuth token refresh
- `createCampaign(accountId, params)` — platform-specific params
- `fetchMetrics(campaignId)` — standardized return: `{ impressions, clicks, spend_cents, conversions }`

### Step 3: Platform-specific system prompt
Update `lib/groq.ts` — add `GOOGLE_SYSTEM_PROMPT`, `TIKTOK_SYSTEM_PROMPT` etc. Each locks LLM to that platform's conventions and terminology.

### Step 4: Healthgate adapter
Update `lib/healthgate.ts` — `calculateHealthChecks(accountData, platform: 'meta' | 'google' | 'tiktok')`. Platform-specific checks with the same 0-100 output contract.

### Step 5: Auth flow
- Create `app/api/auth/[platform]/start/route.ts` and `callback/route.ts`
- Update `app/api/auth/meta/start/route.ts` guard to also accept new platforms

### Step 6: UI
- Update `app/(app)/accounts/connect/page.tsx` to show platform selector
- Update `app/(app)/accounts/page.tsx` to show platform badges per account

### Step 7: Actions
- Update `app/(app)/tests/new/actions.ts` to branch on `platform` field of the ad account

---

## 10. Key API Routes Reference

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/accounts` | List all ad accounts for org |
| POST | `/api/accounts/byok` | Save a manually pasted access token |
| GET | `/api/auth/meta/start` | Start Meta OAuth flow |
| GET | `/api/auth/meta/callback` | Meta OAuth callback |
| GET | `/api/health/sync?account_id=act_XXX` | Compute + store health score |
| POST | `/api/ai/extract` | Groq: extract angle from URL/idea |
| POST | `/api/angle/generate` | Groq: generate Meta FB Feed angle |
| POST | `/api/lp/deploy` | Deploy LP HTML to Vercel Blob |
| POST | `/api/lp/track` | Ingest LP pixel event |
| GET | `/api/reports/[test_id]` | JSON or PDF report |
| POST | `/api/webhooks/meta` | Meta webhook receiver |
| GET | `/api/cron/health` | (cron) daily health sync |
| GET | `/api/cron/metrics` | (cron) daily metrics pull |
| GET | `/api/cron/verdict` | (cron) daily verdict |

---

## 11. Live Meta Sandbox Account Details

- **Ad Account**: `act_727146616453623`
- **Internal DB ID**: `5e469009-f649-4ef7-afe4-f94b9ea944ff`
- **Org ID**: `00000000-0000-0000-0000-000000000001` (default dev org)
- **Account Status**: 1 (active) ✅
- **Token Owner**: Jessi Pavia (user_id: `2190120188405817`)
- **App ID**: `4411532059166723`
- **App Mode**: DEVELOPMENT ⚠️ (must switch to Live for creatives)
- **Page ID**: `1104494692741860` (requires `pages_read_engagement` scope)

---

## 12. Next Immediate Steps (in priority order)

1. **Push `new_property` branch to Vercel** → deploys `/terms` page → unblocks Meta App Review
2. **Switch Meta app to Live mode** in [Meta Developer Console](https://developers.facebook.com/apps/4411532059166723) → unblocks ad creative creation (error_subcode 1885183)
3. **Regenerate Meta access token** with full scopes (`ads_management`, `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`) → update in Supabase DB row + `.env`
4. **Implement Supabase Vault** for token encryption → security prerequisite for production launch
5. **Begin Phase 2: Google Ads integration** following the pattern in Section 9

---

## 13. Build Status

- `npx next build` — **PASSES** ✅ (all 38 routes compiled, no errors)
- Only warning: CSS `@theme` lint (non-blocking, Tailwind v4 feature)
- Branch: `new_property` on GitHub repo `JessiP23/launch-lense`
- Deployed at: `https://launch-lense.vercel.app`

---

*This document is the single source of truth for the LaunchLense project state. Update it after each major session.*
