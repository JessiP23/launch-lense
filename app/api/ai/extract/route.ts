import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { idea, audience, offer } = body;

  if (!idea) {
    return Response.json({ error: 'Missing idea field' }, { status: 400 });
  }

  // Check for demo mode
  const isDemo = request.headers.get('x-demo-mode') === '1';

  if (isDemo) {
    // Return mock AI-generated angles
    const mockResult = {
      icp: audience || 'Small business owners in US, 25-55, tech-savvy',
      value_prop: `AI-powered solution that saves ${audience || 'professionals'} 10+ hours/week`,
      angles: [
        {
          headline: `Stop Wasting Time on ${idea}`,
          primary_text: `${idea} is broken. Our AI fixes it in minutes, not weeks. ${offer || 'Try free for 14 days'}.`,
          cta: 'LEARN_MORE',
        },
        {
          headline: `${idea}: The Smart Way`,
          primary_text: `Join 500+ businesses using AI to transform ${idea}. ${offer || 'Start your free trial today'}.`,
          cta: 'SIGN_UP',
        },
        {
          headline: `Why Top Companies Choose AI for ${idea}`,
          primary_text: `Reduce costs by 60% with automated ${idea}. ${offer || 'Book a demo in 30 seconds'}.`,
          cta: 'LEARN_MORE',
        },
      ],
    };

    return Response.json(mockResult);
  }

  // Production: Call Groq API
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return Response.json(
      { error: 'GROQ_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    const prompt = `You are an expert direct response ad copywriter. Given a startup idea, audience, and offer, extract the ICP (ideal customer profile), value proposition, and generate exactly 3 ad angles.

Each angle must have: headline (max 40 chars), primary_text (max 125 chars), cta (one of: LEARN_MORE, SIGN_UP, SHOP_NOW, DOWNLOAD, BOOK_TRAVEL, CONTACT_US).

Idea: ${idea}
Audience: ${audience || 'Not specified'}
Offer: ${offer || 'Not specified'}

Respond in JSON only:
{
  "icp": "string",
  "value_prop": "string",
  "angles": [
    {"headline": "string", "primary_text": "string", "cta": "string"}
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
        messages: [{ role: 'user', content: prompt }],
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

    const result = JSON.parse(content);
    return Response.json(result);
  } catch (err) {
    console.error('AI extract error:', err);
    return Response.json(
      { error: 'AI extraction failed' },
      { status: 500 }
    );
  }
}
