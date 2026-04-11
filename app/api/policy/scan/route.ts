export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

const BANNED_WORDS = ['guarantee', 'guaranteed', 'you will', 'before/after', 'cure', 'miracle'];
const MAX_TEXT_IN_IMAGE_PERCENT = 20;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { headline, primary_text, image_text_percent } = body;

  const issues: string[] = [];

  // Check for banned words
  const allText = `${headline || ''} ${primary_text || ''}`.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (allText.includes(word)) {
      issues.push(`Banned word detected: "${word}". This will cause ad rejection.`);
    }
  }

  // Check text in image ratio
  if (image_text_percent && image_text_percent > MAX_TEXT_IN_IMAGE_PERCENT) {
    issues.push(
      `Image contains ${image_text_percent}% text. Meta recommends under ${MAX_TEXT_IN_IMAGE_PERCENT}%. Ads with too much text get lower reach.`
    );
  }

  // Check headline length
  if (headline && headline.length > 40) {
    issues.push(`Headline is ${headline.length} chars. Max recommended is 40.`);
  }

  // Check primary text length
  if (primary_text && primary_text.length > 125) {
    issues.push(`Primary text is ${primary_text.length} chars. Max recommended is 125.`);
  }

  const risk_level = issues.length >= 2 ? 'high' : issues.length === 1 ? 'medium' : 'low';
  const blocked = risk_level === 'high';

  return Response.json({
    risk_level,
    blocked,
    issues,
    message: blocked
      ? 'Ad content blocked due to policy violations. Fix issues before proceeding.'
      : issues.length > 0
      ? 'Some issues detected. Review before launch.'
      : 'Content looks good. Ready to deploy.',
  });
}
