/**
 * POST /api/ai/genome
 * Phase 0 — Genome pre-qualification. Results cached in Redis 6h.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { callGroqJSON } from '@/lib/groq';
import { buildAgentPrompt, buildGenomePrompt, type GenomeOutput } from '@/lib/prompts';
import { cachedJSON } from '@/lib/redis';

export async function POST(request: NextRequest) {
  const body = await request.json() as { idea?: string };
  const { idea } = body;

  if (!idea || typeof idea !== 'string' || idea.trim().length < 5) {
    return Response.json({ error: 'idea must be a non-empty string (min 5 chars)' }, { status: 400 });
  }

  try {
    const cacheKey = `genome:${Buffer.from(idea.trim().toLowerCase()).toString('base64').slice(0, 40)}`;

    const output = await cachedJSON<GenomeOutput>(cacheKey, 60 * 60 * 6, async () => {
      const systemPrompt = buildAgentPrompt({ current_phase: 0, active_platforms: ['meta', 'google', 'tiktok'] });
      const userPrompt = buildGenomePrompt(idea.trim());

      const result = await callGroqJSON<Partial<GenomeOutput>>(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        { temperature: 0.3, max_tokens: 900 }
      );

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
