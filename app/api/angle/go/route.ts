/**
 * POST /api/angle/go
 * Phase 2 — Multi-channel asset generation.
 * Accepts channels: ('meta' | 'google' | 'tiktok' | 'linkedin')[]
 * Returns GoOutput — null for channels not requested.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { callGroqJSON } from '@/lib/groq';
import {
  buildAgentPrompt,
  buildGoPrompt,
  type GoOutput,
  type Platform,
} from '@/lib/prompts';

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    idea?: string;
    audience?: string;
    offer?: string;
    channels?: Platform[];
  };
  const { idea, audience = '', offer = '', channels = ['meta'] } = body;

  if (!idea) return Response.json({ error: 'Missing idea' }, { status: 400 });

  try {
    const systemPrompt = buildAgentPrompt({ current_phase: 2, active_platforms: channels });
    const userPrompt = buildGoPrompt({ idea, audience, offer, channels });

    const result = await callGroqJSON<Partial<GoOutput>>(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { temperature: 0.7, max_tokens: 2048 }
    );

    // Normalize — ensure requested channels have values, non-requested are null
    // Note: GoOutput uses 'twitter' field to carry TikTok script data (same structure)
    const output: GoOutput = {
      meta: channels.includes('meta') ? (result.meta ?? null) : null,
      google: channels.includes('google') ? (result.google ?? null) : null,
      reddit: null,
      twitter: channels.includes('tiktok') ? (result.twitter ?? null) : null,
      typeform: null,
    };

    // Clamp Meta fields if present
    if (output.meta) {
      output.meta.headline = String(output.meta.headline ?? '').slice(0, 40);
      output.meta.primary_text = String(output.meta.primary_text ?? '').slice(0, 125);
    }

    // Clamp Google fields if present
    if (output.google) {
      output.google.headlines = (output.google.headlines ?? ['', '', '']).map(
        (h: string) => String(h).slice(0, 30)
      ) as [string, string, string];
      output.google.descriptions = (output.google.descriptions ?? ['', '']).map(
        (d: string) => String(d).slice(0, 90)
      ) as [string, string];
      output.google.path1 = String(output.google.path1 ?? '').slice(0, 15);
      output.google.path2 = String(output.google.path2 ?? '').slice(0, 15);
    }

    return Response.json(output);
  } catch (err) {
    console.error('[angle/go] error:', err);
    return Response.json({ error: 'Multi-channel generation failed' }, { status: 500 });
  }
}
