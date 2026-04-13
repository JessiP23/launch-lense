export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { META_SYSTEM_PROMPT } from '@/lib/groq';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { idea, audience, offer } = body as {
    idea?: string;
    audience?: string;
    offer?: string;
  };

  if (!idea) {
    return Response.json({ error: 'Missing idea field' }, { status: 400 });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return Response.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
  }

  try {
    const prompt = `Generate 3 angles for Meta Facebook Feed ads. Output: primary_text<=125, headline<=40, cta from [LEARN_MORE,SHOP_NOW,SIGN_UP].

Idea: ${idea}
Audience: ${audience || 'Not specified'}
Offer: ${offer || 'Not specified'}

Respond in JSON only:
{
  "icp": "string",
  "value_prop": "string",
  "angles": [
    {"headline": "string", "primary_text": "string", "cta": "LEARN_MORE|SHOP_NOW|SIGN_UP"}
  ]
}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: META_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
    });

    const groqData = await groqRes.json();
    const content = groqData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from Groq');
    }

    const parsed = JSON.parse(content) as {
      icp?: string;
      value_prop?: string;
      angles?: Array<{ headline?: string; primary_text?: string; cta?: string }>;
    };

    const allowedCtas = new Set(['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP']);
    const angles = (parsed.angles || []).slice(0, 3).map((a) => ({
      headline: String(a.headline || '').slice(0, 40),
      primary_text: String(a.primary_text || '').slice(0, 125),
      cta: allowedCtas.has(String(a.cta || '')) ? String(a.cta) : 'LEARN_MORE',
    }));

    return Response.json({
      icp: parsed.icp || '',
      value_prop: parsed.value_prop || '',
      angles,
    });
  } catch (err) {
    console.error('Angle generate error:', err);
    return Response.json({ error: 'Angle generation failed' }, { status: 500 });
  }
}
