/**
 * POST /api/ai/genome
 * Phase 0 — Genome pre-qualification.
 *
 * Pipeline:
 *   1. Fetch real data from Google (Serper) + Meta Ad Library in parallel
 *   2. Pass real data into Llama 3 prompt — LLM interprets real numbers, does NOT invent them
 *   3. Cache result 6h (keyed with real-data hash so stale LLM estimates don't serve)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { callGroqJSON } from '@/lib/groq';
import { buildAgentPrompt, buildGenomePrompt, type GenomeOutput } from '@/lib/prompts';
import { cachedJSON } from '@/lib/redis';
import { fetchRealMarketData } from '@/lib/market-research';

export async function POST(request: NextRequest) {
  const body = await request.json() as { idea?: string };
  const { idea } = body;

  if (!idea || typeof idea !== 'string' || idea.trim().length < 5) {
    return Response.json({ error: 'idea must be a non-empty string (min 5 chars)' }, { status: 400 });
  }

  try {
    // v4: includes real scraped data from Serper + Meta Ad Library
    const cacheKey = `genome:v4:${Buffer.from(idea.trim().toLowerCase()).toString('base64').slice(0, 40)}`;

    const output = await cachedJSON<GenomeOutput>(cacheKey, 60 * 60 * 6, async () => {
      // ── Step 1: Fetch real market data in parallel ──────────────────────
      const realData = await fetchRealMarketData(idea.trim());
      const hasRealData = !!(realData.serper || realData.meta_ads);

      // ── Step 2: LLM interprets real data (not inventing numbers) ────────
      const systemPrompt = buildAgentPrompt({ current_phase: 0, active_platforms: ['meta', 'google', 'tiktok'] });
      const userPrompt = buildGenomePrompt(idea.trim(), realData);

      const result = await callGroqJSON<Partial<GenomeOutput>>(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        { temperature: 0.2, max_tokens: 1000 }
      );

      // ── Step 3: Normalize + attach raw source data ───────────────────────
      const normalized: GenomeOutput = {
        search_volume_monthly: clampInt(result.search_volume_monthly, 0, 10_000_000),
        competitor_ad_density_0_10: clampFloat(result.competitor_ad_density_0_10, 0, 10),
        language_market_fit_0_100: clampFloat(result.language_market_fit_0_100, 0, 100),
        verdict: result.verdict === 'NO-GO' ? 'NO-GO' : 'GO',
        pivot_suggestion_15_words: result.pivot_suggestion_15_words
          ? String(result.pivot_suggestion_15_words).split(' ').slice(0, 15).join(' ')
          : null,
        reasoning_1_sentence: String(result.reasoning_1_sentence ?? 'Insufficient data to score.'),
        step1_keywords: result.step1_keywords ? String(result.step1_keywords) : undefined,
        step2_competitors: result.step2_competitors ? String(result.step2_competitors) : undefined,
        step3_language: result.step3_language ? String(result.step3_language) : undefined,
        // Raw source data — shown verbatim in UI so user can verify
        source_google: realData.serper ? {
          organic_result_count: realData.serper.organic_result_count,
          google_ads_count: realData.serper.google_ads_count,
          related_searches: realData.serper.related_searches,
          top_titles: realData.serper.top_titles,
        } : null,
        source_meta: realData.meta_ads ? {
          active_ads_count: realData.meta_ads.active_ads_count,
          advertiser_names: realData.meta_ads.advertiser_names,
          error: realData.meta_ads.error,
        } : null,
        data_source: hasRealData ? 'real' : 'llm_estimate',
      };

      if (normalized.language_market_fit_0_100 < 40 && normalized.search_volume_monthly < 1000) {
        normalized.verdict = 'NO-GO';
        if (!normalized.pivot_suggestion_15_words) {
          normalized.pivot_suggestion_15_words = 'Narrow audience or reframe problem for search-validated demand.';
        }
      }

      return normalized;
    });

    return Response.json(output);
  } catch (err) {
    console.error('[ai/genome] error:', err);
    return Response.json({ error: 'Genome evaluation failed' }, { status: 500 });
  }
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = parseInt(String(value ?? 0), 10);
  return Number.isNaN(n) ? min : Math.min(Math.max(n, min), max);
}

function clampFloat(value: unknown, min: number, max: number): number {
  const n = parseFloat(String(value ?? 0));
  return Number.isNaN(n) ? min : Math.min(Math.max(n, min), max);
}
