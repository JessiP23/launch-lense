export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { callGroqJSON } from '@/lib/groq';
import {
  buildAgentPrompt,
  buildMetaAnglePrompt,
  type AngleExtractOutput,
  type MetaAngle,
} from '@/lib/prompts';

const ALLOWED_CTAS = new Set<string>(['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP']);

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    idea?: string;
    audience?: string;
    offer?: string;
  };
  const { idea, audience = '', offer = '' } = body;

  if (!idea) {
    return Response.json({ error: 'Missing idea field' }, { status: 400 });
  }

  try {
    const systemPrompt = buildAgentPrompt({ current_phase: 2, active_platforms: ['meta'] });
    const userPrompt = buildMetaAnglePrompt({ idea, audience, offer });

    const result = await callGroqJSON<AngleExtractOutput>(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.7, max_tokens: 1024 }
    );

    // Validate + clamp — never trust LLM field lengths
    const angles: MetaAngle[] = (result.angles ?? []).slice(0, 3).map((a) => ({
      headline: String(a.headline ?? '').slice(0, 40),
      primary_text: String(a.primary_text ?? '').slice(0, 125),
      cta: (ALLOWED_CTAS.has(String(a.cta ?? '')) ? a.cta : 'LEARN_MORE') as MetaAngle['cta'],
    }));

    return Response.json({
      icp: result.icp ?? '',
      value_prop: result.value_prop ?? '',
      angles,
    });
  } catch (err) {
    console.error('[angle/generate] error:', err);
    return Response.json({ error: 'Angle generation failed' }, { status: 500 });
  }
}
