/**
 * lib/prompts.ts
 *
 * LaunchLense Master Agent prompt system.
 * All LLM calls flow through this module. Never hard-code system prompts in route files.
 *
 * Architecture:
 *   LAUNCHLENSE_MASTER_AGENT — raw template with {{variable}} tokens
 *   buildAgentPrompt()       — injects runtime values, returns final system string
 *   PHASE_*                  — typed user-prompt builders per workflow phase
 */

import type { RealMarketData } from './market-research';

// ── Types ──────────────────────────────────────────────────────────────────

export type Platform = 'meta' | 'google' | 'tiktok' | 'linkedin';
export type Phase = 0 | 1 | 2 | 3;
export type Verdict = 'GO' | 'NO-GO' | 'ITERATE';

/** Runtime variables injected into the master agent template. */
export interface AgentContext {
  current_phase: Phase;
  active_platforms: Platform[];
}

// ── Phase 0: Genome Output ─────────────────────────────────────────────────

export interface GenomeOutput {
  search_volume_monthly: number;
  competitor_ad_density_0_10: number;
  language_market_fit_0_100: number;
  verdict: 'GO' | 'NO-GO';
  pivot_suggestion_15_words: string | null;
  reasoning_1_sentence: string;
  /** Real scraped data shown to the user */
  step1_keywords?: string;       // search demand interpretation
  step2_competitors?: string;    // competitor ad landscape interpretation
  step3_language?: string;       // language–market fit interpretation
  /** Raw source data from real APIs (shown verbatim in UI) */
  source_google?: {
    organic_result_count: number;
    google_ads_count: number;
    related_searches: string[];
    top_titles: string[];
  } | null;
  source_meta?: {
    active_ads_count: number;
    advertiser_names: string[];
    error?: string;
  } | null;
  data_source: 'real' | 'llm_estimate'; // tells the UI whether real APIs fired
}

// ── Phase 1: Gate Output ───────────────────────────────────────────────────

export interface GateOutput {
  score_0_100: number;
  status: 'GREEN' | 'YELLOW' | 'RED';
  blocking_issues: string[];
}

// ── Phase 2: Go Output ────────────────────────────────────────────────────

export interface MetaAngle {
  headline: string;      // ≤ 40 chars
  primary_text: string;  // ≤ 125 chars
  cta: 'LEARN_MORE' | 'SHOP_NOW' | 'SIGN_UP';
}

export interface GoogleAngle {
  headlines: [string, string, string];  // ≤ 30 chars each
  descriptions: [string, string];       // ≤ 90 chars each
  keywords: string[];
  negative_keywords: string[];
  path1: string;  // ≤ 15 chars
  path2: string;  // ≤ 15 chars
}

export interface RedditAngle {
  subreddit: string;
  title: string;
  body_md: string;
  disclaimer: string;
}

export interface TwitterAngle {
  tweet_1_hook: string;   // ≤ 280 chars
  thread_body: string[];  // 3-5 tweets
  cta_link_text: string;
}

export interface TypeformAngle {
  title: string;
  description: string;
  questions: Array<{ text: string; type: string }>;
  submit_btn: string;
}

export interface GoOutput {
  meta: MetaAngle | null;
  google: GoogleAngle | null;
  reddit: RedditAngle | null;
  twitter: TwitterAngle | null;
  typeform: TypeformAngle | null;
}

// ── Phase 3: Verdict Output ────────────────────────────────────────────────

export interface ChannelBreakdown {
  channel: string;
  score_0_100: number;
  key_metric: string;
}

export interface VerdictOutput {
  verdict: Verdict;
  composite_score_0_100: number;
  channel_breakdown: ChannelBreakdown[];
  reason_1_sentence: string;
  next_step: string;
}

// ── Phase 2: Angle-extract (backward-compat) ──────────────────────────────

export interface AngleExtractOutput {
  icp: string;
  value_prop: string;
  angles: MetaAngle[];
}

// ── Master Agent Template ──────────────────────────────────────────────────

const MASTER_AGENT_TEMPLATE = `
You are LaunchLense Core v2.0, the AI engine inside LaunchLense — "ad account insurance for venture studios."

## MISSION
Validate startup ideas in 48 hours for $500 using multi-channel signal, not just paid ads. You are ruthlessly pragmatic, anti-hype, data-dense. Your job is to reduce risk BEFORE spend and maximize signal DURING spend.

## BRAND VOICE
Tone: Vercel meets ad tech. Minimal. Direct. No buzzwords.
Format: Tables, bullets, scores 0-100. Show math.
If the idea is bad, output "NO-GO" in first line + 1 sentence reason. Never soften.

## CORE WORKFLOW: "Genome → Gate → Go → Verdict"
You operate in 4 phases. Never skip. Current phase = {{CURRENT_PHASE}}.

### PHASE 0: GENOME [pre-spend, pre-clock]
Goal: Kill bad ideas in 1 second using search intent, not opinions.
Input: startup_idea_string
Output JSON: {
  search_volume_monthly: number,
  competitor_ad_density_0_10: number,
  language_market_fit_0_100: number,
  verdict: "GO"|"NO-GO",
  pivot_suggestion_15_words: string|null,
  reasoning_1_sentence: string
}
Rules:
1. language_market_fit < 40 AND search_volume < 1000 → verdict = "NO-GO".
2. competitor_ad_density: 0=blue ocean, 10=Meta/Google saturated.
3. Be brutal. This saves $500. If NO-GO, pivot_suggestion is mandatory.

### PHASE 1: GATE [pre-spend, pre-clock]
Goal: Block broken ad accounts. Same 0-100 Healthgate score for all platforms.
Input: { platform: "meta"|"google", account_data }
Output JSON: { score_0_100: number, status: "GREEN"|"YELLOW"|"RED", blocking_issues: string[] }
Rules:
1. score < 60 = RED = launch blocked.
2. Meta checks: account_status, balance, disapproved_90d, pixel_active, funding_source, 2FA, domain_verified, policy_issues.
3. Google checks: billing_active, policy_violations, conversion_tracking_active, avg_quality_score > 3, domain_disapprovals = 0.

### PHASE 2: GO [clock starts, T+0 to T+48h]
Goal: Generate production-ready assets for all selected channels. You do not ask user to write copy.
Input: { idea, channels: string[], active_ad_account }
Output JSON: {
  meta: { headline, primary_text, cta } | null,
  google: { headlines: string[3], descriptions: string[2], keywords: string[], negative_keywords: string[], path1, path2 } | null,
  reddit: { subreddit, title, body_md, disclaimer } | null,
  twitter: { tweet_1_hook, thread_body: string[], cta_link_text } | null,
  typeform: { title, description, questions: {text, type}[], submit_btn } | null
}
Channel-Specific Rules:
1. Meta: headline ≤40 chars, primary_text ≤125 chars, cta ∈ [LEARN_MORE, SHOP_NOW, SIGN_UP]
2. Google: headlines ≤30 chars each, descriptions ≤90 each, path1/path2 ≤15 chars. Keywords must have purchase intent. Include 3 negative keywords.
3. Reddit: NO marketing speak. Title = question or "I built X to solve Y". body_md = 1st person, problem story, soft ask for feedback. Must include disclaimer: "Not selling anything, validating demand for 48h test."
4. Twitter: tweet_1_hook ≤280 chars, punchy, problem-led. Thread = 3-5 tweets max. Last tweet = link + "Testing this for 48h. Thoughts?"
5. Typeform: title = value prop, not feature. Max 3 questions. Q1 always "What's your email?" type=email. submit_btn = "Join Waitlist".

### PHASE 3: VERDICT [T+48h]
Goal: One unified score across all channels. No vanity metrics.
Input: { metrics: { meta, google, reddit, twitter, typeform } }
Output JSON: {
  verdict: "GO"|"NO-GO"|"ITERATE",
  composite_score_0_100: number,
  channel_breakdown: { channel: string, score_0_100: number, key_metric: string }[],
  reason_1_sentence: string,
  next_step: string
}
Scoring weights: Meta_CVR*0.4 + Google_CVR*0.3 + Typeform_EmailRate*0.2 + Reddit_UpvoteRate*0.05 + Twitter_ClickRate*0.05
GO threshold: composite_score ≥ 65. ITERATE: 45-64. NO-GO: < 45.

## PLATFORM LOCK
active_platforms = {{ACTIVE_PLATFORMS}}. You ONLY generate assets for platforms in this array. If user asks for a platform NOT in this array, reply: "That platform is not yet active. Currently supporting: {{ACTIVE_PLATFORMS}}."

## SECURITY & CONTEXT
1. Never ask for access_tokens, passwords, API keys. Reference "connected {{PLATFORM_SINGULAR}} account" only.
2. All money values in cents. All rates as 0.00-1.00.
3. If data is missing, say "Insufficient data" — do NOT output 0 or hallucinate metrics.

You are a senior growth engineer. Think in CAC, LTV, payback period. Be brief. Return valid JSON only when the phase calls for it.
`.trim();

// ── Builder ────────────────────────────────────────────────────────────────

/**
 * Injects runtime context into the master agent template.
 * Call this once per request — the result is the `system` message content.
 */
export function buildAgentPrompt(ctx: AgentContext): string {
  const platformList = ctx.active_platforms.join(', ');
  const primaryPlatform = ctx.active_platforms[0] ?? 'meta';

  return MASTER_AGENT_TEMPLATE
    .replace(/\{\{CURRENT_PHASE\}\}/g, String(ctx.current_phase))
    .replace(/\{\{ACTIVE_PLATFORMS\}\}/g, platformList)
    .replace(/\{\{PLATFORM_SINGULAR\}\}/g, primaryPlatform);
}

// ── Phase User-Prompt Builders ─────────────────────────────────────────────

/** Phase 0 — idea pre-qualification using REAL scraped data */
export function buildGenomePrompt(idea: string, realData?: RealMarketData): string {
  const hasRealData = realData && (realData.serper || realData.meta_ads);

  if (hasRealData) {
    const g = realData.serper;
    const m = realData.meta_ads;

    const googleSection = g ? `
GOOGLE SEARCH (live data via Serper — scraped right now):
- Total indexed pages for this query: ${g.organic_result_count.toLocaleString()}
- Active Google advertisers buying this keyword right now: ${g.google_ads_count}
- What buyers actually search (Google related searches): ${g.related_searches.slice(0, 6).join(' | ')}
- Top organic page titles: ${g.top_titles.slice(0, 4).join(' | ')}
- First result snippet: "${g.top_snippet}"${g.knowledge_graph_title ? `\n- Google Knowledge Graph card exists for: "${g.knowledge_graph_title}" (signals established category)` : ''}
`.trim() : 'Google data unavailable.';

    const metaSection = m && !m.error ? `
META AD LIBRARY (live data — active ads in last 90 days):
- Active Meta/Instagram ads matching this niche: ${m.active_ads_count}${m.active_ads_count === 25 ? '+ (API cap reached — market is saturated)' : ''}
- Actual advertisers running these ads: ${m.advertiser_names.length > 0 ? m.advertiser_names.join(', ') : 'No recognizable brands found (blue ocean signal)'}
`.trim() : m?.error ? `Meta Ad Library: API error — ${m.error}` : 'Meta Ad Library data unavailable.';

    return `You are a market analyst. You have been given REAL live data scraped from Google and Meta Ad Library for this startup idea. Your job is to interpret this real data — do NOT invent numbers, use only what is provided.

IDEA: "${idea}"

--- REAL SCRAPED DATA ---

${googleSection}

${metaSection}

--- YOUR ANALYSIS TASK ---

Based ONLY on the real data above:

Step 1 — SEARCH DEMAND: Using the Google organic count and related searches provided, estimate monthly search volume for the category. Explain which related searches signal buyer intent vs. informational queries. Store as "step1_keywords".

Step 2 — AD SATURATION: Using the Meta active ad count (${m?.active_ads_count ?? 'unknown'}) and the actual advertiser names provided, explain how competitive this space is. If 25 ads hit the API cap, this is a saturated market. Store as "step2_competitors".

Step 3 — LANGUAGE FIT: Compare the idea's wording to the related searches buyers actually use. Do buyers search for the exact terms in the idea, or different words? Score 0-100. Store as "step3_language".

Step 4 — VERDICT: Should a founder spend $500 testing this NOW? Rule: if language_market_fit < 40 AND estimated search_volume < 1000 → force NO-GO.

Return ONLY this JSON (no prose, no markdown fences):
{
  "step1_keywords": "<interpretation of the Google data — which related searches show demand, estimated volume>",
  "search_volume_monthly": <integer derived from Google data>,
  "step2_competitors": "<interpretation of Meta Ad Library data — named advertisers, what the count means>",
  "competitor_ad_density_0_10": <float 0-10 based on real ad count: 0-2 ads=1-3, 3-8=4-6, 9-20=7-8, 25+=9-10>,
  "step3_language": "<how idea wording maps to the actual related searches buyers use>",
  "language_market_fit_0_100": <float 0-100>,
  "verdict": "GO" | "NO-GO",
  "pivot_suggestion_15_words": <string if NO-GO, null if GO>,
  "reasoning_1_sentence": <string citing the actual data: e.g. "Google shows 4 active advertisers and 12K related searches, signaling validated demand with manageable competition">
}`;
  }

  // Fallback: no real data available (API keys not configured)
  return `You are a senior market analyst. Evaluate this startup idea. Note: real API data was unavailable so you must estimate from training knowledge — be explicit about this uncertainty.

Idea: "${idea}"

Step 1 — SEARCH DEMAND: Estimate monthly search volume. Name specific keywords. Be explicit this is an estimate. Store as "step1_keywords".
Step 2 — AD SATURATION: Name known companies in this space. Estimate saturation 0-10. Be explicit this is an estimate. Store as "step2_competitors".
Step 3 — LANGUAGE FIT: Score language alignment 0-100. Store as "step3_language".
Step 4 — VERDICT: GO/NO-GO. Rule: language_market_fit < 40 AND search_volume < 1000 → NO-GO.

Return ONLY this JSON (no prose, no markdown fences):
{
  "step1_keywords": "<estimated keywords + caveat that this is LLM estimate, not live data>",
  "search_volume_monthly": <integer>,
  "step2_competitors": "<estimated competitors + caveat>",
  "competitor_ad_density_0_10": <float 0-10>,
  "step3_language": "<language fit analysis>",
  "language_market_fit_0_100": <float 0-100>,
  "verdict": "GO" | "NO-GO",
  "pivot_suggestion_15_words": <string if NO-GO, null if GO>,
  "reasoning_1_sentence": <string — note this is an LLM estimate, not live data>
}`;
}

/** Phase 2 — multi-channel asset generation */
export function buildGoPrompt(params: {
  idea: string;
  audience: string;
  offer: string;
  channels: Platform[];
}): string {
  return `Generate production-ready ad assets for the following sprint.

Idea: "${params.idea}"
Audience: "${params.audience || 'Not specified'}"
Offer: "${params.offer || 'Not specified'}"
Channels requested: ${params.channels.join(', ')}

Return JSON only matching the GO phase schema. Set channels not requested to null.`;
}

/** Phase 2 — Meta-only angle extraction (backward-compat for /api/ai/extract) */
export function buildMetaAnglePrompt(params: {
  idea: string;
  audience: string;
  offer: string;
}): string {
  return `Generate exactly 3 Meta Facebook Feed ad angles.

Idea: "${params.idea}"
Audience: "${params.audience || 'Not specified'}"
Offer: "${params.offer || 'Not specified'}"

Return JSON only:
{
  "icp": "string — 1 sentence ideal customer profile",
  "value_prop": "string — 1 sentence core value proposition",
  "angles": [
    { "headline": "string (max 40 chars)", "primary_text": "string (max 125 chars)", "cta": "LEARN_MORE|SHOP_NOW|SIGN_UP" },
    { "headline": "string (max 40 chars)", "primary_text": "string (max 125 chars)", "cta": "LEARN_MORE|SHOP_NOW|SIGN_UP" },
    { "headline": "string (max 40 chars)", "primary_text": "string (max 125 chars)", "cta": "LEARN_MORE|SHOP_NOW|SIGN_UP" }
  ]
}`;
}

/** Phase 3 — unified verdict computation */
export function buildVerdictPrompt(metrics: {
  meta?: { ctr: number; cvr: number; spend_cents: number } | null;
  google?: { ctr: number; cvr: number; spend_cents: number } | null;
  reddit?: { upvote_rate: number; comment_count: number } | null;
  twitter?: { click_rate: number; impression_count: number } | null;
  typeform?: { email_rate: number; submission_count: number } | null;
}): string {
  return `Compute the sprint verdict from the following channel metrics.

Metrics: ${JSON.stringify(metrics, null, 2)}

Apply scoring weights: Meta_CVR*0.4 + Google_CVR*0.3 + Typeform_EmailRate*0.2 + Reddit_UpvoteRate*0.05 + Twitter_ClickRate*0.05

Return JSON only matching the VERDICT phase schema.`;
}
