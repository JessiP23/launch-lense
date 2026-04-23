/**
 * POST /api/angle/improve
 * Rewrites a single ad copy field using Groq.
 * Body: { platform, field, value, idea, audience?, offer? }
 * Returns: { improved: string }
 */

import { NextRequest } from 'next/server';
import { callGroq } from '@/lib/groq';

const FIELD_INSTRUCTIONS: Record<string, string> = {
  // Meta
  headline:      'Rewrite this Meta ad headline. Max 40 chars. Make it punchy, benefit-first, no hype words.',
  primary_text:  'Rewrite this Meta ad primary text. Max 125 chars. Lead with pain point, then solution. No emojis unless they add meaning.',
  cta:           'Return only one of: LEARN_MORE | SHOP_NOW | SIGN_UP | GET_QUOTE | BOOK_NOW — pick the best fit for the idea.',
  // Google
  google_headline: 'Rewrite this Google RSA headline. Max 30 chars. Keyword-dense, no punctuation at end.',
  google_description: 'Rewrite this Google RSA description. Max 90 chars. Include a call-to-action. Concise.',
  // TikTok
  hook:          'Rewrite this TikTok ad hook (first 3 seconds of video script). Max 15 words. Start with a provocative question or bold claim.',
  script_beat:   'Rewrite this TikTok script beat. Max 20 words. Conversational, energetic, present-tense.',
  tiktok_cta:    'Rewrite this TikTok CTA overlay text. Max 8 words. Action verb first.',
  // LinkedIn
  linkedin_headline: 'Rewrite this LinkedIn Sponsored Content headline. Max 70 chars. Professional tone, specific benefit, no buzzwords.',
  linkedin_intro:    'Rewrite this LinkedIn ad intro text. Max 150 chars. Lead with insight or stat. End with soft CTA.',
};

export async function POST(req: NextRequest) {
  try {
    const { platform, field, value, idea, audience, offer } = await req.json() as {
      platform: string;
      field: string;
      value: string;
      idea: string;
      audience?: string;
      offer?: string;
    };

    const instruction = FIELD_INSTRUCTIONS[field] ?? `Improve this ad copy field for ${platform}. Keep the same intent but make it sharper.`;

    const contextLine = [
      `Idea: ${idea}`,
      audience ? `Audience: ${audience}` : null,
      offer ? `Offer: ${offer}` : null,
    ].filter(Boolean).join(' | ');

    const improved_text = await callGroq(
      [
        {
          role: 'system',
          content: `You are a world-class performance copywriter. You output ONLY the rewritten text — no labels, no quotes, no explanation. ${instruction}`,
        },
        {
          role: 'user',
          content: `Context: ${contextLine}\n\nCurrent text: ${value}\n\nRewrite it now:`,
        },
      ],
      { temperature: 0.7, max_tokens: 120 }
    );

    const improved = improved_text.trim() ?? value;
    return Response.json({ improved });
  } catch (err) {
    console.error('[improve]', err);
    return Response.json({ error: 'Improve failed' }, { status: 500 });
  }
}
