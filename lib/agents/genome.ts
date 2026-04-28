// ─────────────────────────────────────────────────────────────────────────────
// GenomeAgent — 5-axis startup pre-screening
// Runs first in every sprint. Composite < 40 → STOP (no ad spend).
// ─────────────────────────────────────────────────────────────────────────────

import { callGroqJSON } from '@/lib/groq';
import { fetchRealMarketData } from '@/lib/market-research';
import type { GenomeAgentOutput, GenomeScores } from './types';

// ── Weights per axis ───────────────────────────────────────────────────────
const WEIGHTS: Record<keyof GenomeScores, number> = {
  demand:      0.30,
  icp:         0.25,
  competition: 0.20,
  timing:      0.15,
  moat:        0.10,
};

export function computeComposite(scores: GenomeScores): number {
  return Math.round(
    scores.demand      * WEIGHTS.demand +
    scores.icp         * WEIGHTS.icp +
    scores.competition * WEIGHTS.competition +
    scores.timing      * WEIGHTS.timing +
    scores.moat        * WEIGHTS.moat
  );
}

function signalFromComposite(composite: number): GenomeAgentOutput['signal'] {
  if (composite >= 70) return 'GO';
  if (composite >= 40) return 'ITERATE';
  return 'STOP';
}

type RawGenomeResponse = {
  scores: GenomeScores;
  icp: string;
  problem_statement: string;
  solution_wedge: string;
  market_category: string;
  unique_mechanism: string;
  risks: string[];
  pivot_brief: string | null;
  proceed_note: string | null;
  research_sources: string[];
};

function fallbackGenomeResponse(idea: string, hasReal: boolean): RawGenomeResponse {
  return {
    scores: {
      demand: hasReal ? 62 : 52,
      competition: hasReal ? 58 : 50,
      icp: 64,
      timing: 60,
      moat: 46,
    },
    icp: 'Founder or growth lead with a time-sensitive need to validate demand before committing engineering budget.',
    problem_statement: `Teams are trying to determine whether "${idea.slice(0, 120)}" has enough market pull before they build.`,
    solution_wedge: 'Run a constrained validation sprint that turns early market interest into channel-specific evidence.',
    market_category: 'Startup validation and demand testing',
    unique_mechanism: 'Combines market pre-screening, account health checks, channel-specific ads, and normalized verdict math in one stateful workflow.',
    risks: [
      hasReal
        ? 'Live research was partially available, but the scoring model fallback was used; treat this as a directional signal until the LLM provider is healthy.'
        : 'Live research and LLM scoring were unavailable; this fallback is directional and should be rerun before committing spend.',
      'ICP needs to stay narrow enough for ad targeting; broad founder audiences can make CTR data hard to interpret.',
      'Moat is not proven by ad interest alone; a GO signal still needs product-level defensibility validation.',
    ],
    pivot_brief: null,
    proceed_note: 'Watch whether at least two angles beat channel-normalized CTR thresholds; one winning angle is not enough to justify a full build.',
    research_sources: hasReal ? ['market research hooks', 'fallback scoring'] : ['fallback scoring'],
  };
}

// ── System prompt ──────────────────────────────────────────────────────────
const GENOME_SYSTEM = `You are GenomeAgent inside LaunchLense — a ruthless market pre-screener.
Your job: score a startup idea across 5 axes using REAL data provided to you.
You DO NOT invent data. You interpret only what is in the <REAL_DATA> section.
You are brutally honest. If the idea is bad, say so. You save founders $500 and 48 hours.
Format: return ONLY valid JSON — no prose, no markdown fences.`;

// ── Main runner ────────────────────────────────────────────────────────────
export async function runGenomeAgent(idea: string): Promise<GenomeAgentOutput> {
  const t0 = Date.now();

  // 1. Fetch live market data in parallel
  const realData = await fetchRealMarketData(idea.trim());
  const hasReal = !!(realData.serper || realData.meta_ads);

  const g = realData.serper;
  const m = realData.meta_ads;

  const googleSection = g
    ? `GOOGLE LIVE DATA:
- Organic results: ${g.organic_result_count.toLocaleString()}
- Active paid advertisers: ${g.google_ads_count}
- Related buyer searches: ${g.related_searches.slice(0, 8).join(' | ')}
- Top organic titles: ${g.top_titles.slice(0, 4).join(' | ')}
- Top snippet: "${g.top_snippet ?? 'N/A'}"
`
    : 'Google data: unavailable — use LLM estimate only, note uncertainty.';

  const metaSection = m && !m.error
    ? `META AD LIBRARY LIVE DATA:
- Active Meta/IG ads (last 90 days): ${m.active_ads_count}${m.active_ads_count === 25 ? '+ (API cap — saturated)' : ''}
- Named advertisers: ${m.advertiser_names.length ? m.advertiser_names.join(', ') : 'None found (blue ocean signal)'}
`
    : `Meta Ad Library: ${m?.error ?? 'unavailable'}`;

  const userPrompt = `You are scoring this startup idea using the real data below.

IDEA: "${idea}"

<REAL_DATA>
${googleSection}
${metaSection}
</REAL_DATA>

Score each axis 0-100 based ONLY on the data above. Then extract the ICP, problem, solution, and generate risks — each risk MUST cite a specific signal from the data (never a generic warning).

Scoring guide:
- demand: 0=no evidence people search/complain about this problem, 100=massive proven search volume + active advertisers
- competition: 0=extremely crowded (25+ funded competitors), 100=blue ocean (0-2 advertisers, no incumbents)  
- icp: 0=can't name the buyer or reason they buy today, 100=crystal clear buyer persona with named trigger event
- timing: 0=macro headwinds or declining category, 100=strong tailwinds, recent VC activity, rising searches
- moat: 0=pure commodity feature, 100=data flywheel / network effect / deep switching cost

Return ONLY this JSON:
{
  "scores": {
    "demand": <0-100>,
    "competition": <0-100>,
    "icp": <0-100>,
    "timing": <0-100>,
    "moat": <0-100>
  },
  "icp": "<named buyer — job title, company stage, trigger event that makes them buy TODAY>",
  "problem_statement": "<one sentence — the specific painful problem this solves>",
  "solution_wedge": "<one sentence — the unique mechanism of your solution vs alternatives>",
  "market_category": "<existing category this lives in, named>",
  "unique_mechanism": "<what makes this solution work differently — one sentence>",
  "risks": [
    "<risk 1 — must cite a specific data point from REAL_DATA above>",
    "<risk 2 — must cite a specific data point>",
    "<risk 3 — must cite a specific data point>"
  ],
  "pivot_brief": "<if STOP — specific pivot direction with rationale, else null>",
  "proceed_note": "<if GO or ITERATE — what to watch for in the live test, seeded from data above, else null>",
  "research_sources": ["<source 1>", "<source 2>"]
}`;

  let raw: RawGenomeResponse;
  try {
    raw = await callGroqJSON<RawGenomeResponse>(
      [{ role: 'system', content: GENOME_SYSTEM }, { role: 'user', content: userPrompt }],
      { temperature: 0.2, max_tokens: 1200 }
    );
  } catch (err) {
    console.warn('[GenomeAgent] Falling back to deterministic scoring:', err);
    raw = fallbackGenomeResponse(idea, hasReal);
  }

  // 2. Clamp + validate scores
  const clamp = (v: unknown, min = 0, max = 100) =>
    Math.max(min, Math.min(max, Math.round(Number(v) || 0)));

  const scores: GenomeScores = {
    demand:      clamp(raw.scores?.demand),
    competition: clamp(raw.scores?.competition),
    icp:         clamp(raw.scores?.icp),
    timing:      clamp(raw.scores?.timing),
    moat:        clamp(raw.scores?.moat),
  };

  const composite = computeComposite(scores);
  const signal = signalFromComposite(composite);

  // 3. ICP flag — if ICP < 40, risks must include it regardless of composite
  const risks: string[] = Array.isArray(raw.risks) ? raw.risks.slice(0, 5) : [];
  if (scores.icp < 40 && !risks.some((r) => /icp|buyer|customer|audience/i.test(r))) {
    risks.unshift(
      `ICP score is ${scores.icp}/100 — you cannot name the exact buyer or their trigger event today. This will make ad targeting and data interpretation unreliable.`
    );
  }

  const output: GenomeAgentOutput = {
    signal,
    composite,
    scores,
    icp: String(raw.icp ?? ''),
    problem_statement: String(raw.problem_statement ?? ''),
    solution_wedge: String(raw.solution_wedge ?? ''),
    market_category: String(raw.market_category ?? ''),
    unique_mechanism: String(raw.unique_mechanism ?? ''),
    risks,
    pivot_brief: signal === 'STOP' ? (String(raw.pivot_brief ?? '') || 'Narrow the problem or reframe for a more search-validated niche.') : null,
    proceed_note: signal !== 'STOP' ? (String(raw.proceed_note ?? '') || null) : null,
    research_sources: Array.isArray(raw.research_sources) ? raw.research_sources : [],
    source_google: g ? {
      organic_result_count: g.organic_result_count,
      google_ads_count: g.google_ads_count,
      related_searches: g.related_searches,
      top_titles: g.top_titles,
      top_snippet: g.top_snippet,
    } : null,
    source_meta: m ? {
      active_ads_count: m.active_ads_count,
      advertiser_names: m.advertiser_names,
      error: m.error,
    } : null,
    data_source: hasReal ? 'real' : 'llm_estimate',
    elapsed_ms: Date.now() - t0,
  };

  return output;
}
