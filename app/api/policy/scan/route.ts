// ─────────────────────────────────────────────────────────────────────────────
// POST /api/policy/scan
//
// Stateless preview of the v10 Meta policy scanner. Accepts the editable
// creative fields and returns the rich PolicyScanResult plus a back-compat
// envelope so older clients (and the Meta deployment gate) read the same
// shape they always have.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { scanCreative, type PolicyScanInput } from '@/lib/policy/scan';
import type { PolicySeverity } from '@/lib/agents/types';

// Optional `image_text_percent` carries over from the old endpoint — kept so
// existing pixel-side analyzers can still push their image-OCR estimate
// through the same pipeline.
const RequestSchema = z.object({
  platform: z.enum(['meta', 'google', 'linkedin', 'tiktok']).optional(),
  headline: z.string().max(2000).nullish(),
  primary_text: z.string().max(20000).nullish(),
  description: z.string().max(2000).nullish(),
  cta: z.string().max(120).nullish(),
  display_link: z.string().max(2000).nullish(),
  hook: z.string().max(2000).nullish(),
  overlay_text: z.string().max(2000).nullish(),
  callout: z.string().max(2000).nullish(),
  audience_label: z.string().max(2000).nullish(),
  image_url: z.string().max(2000).nullish(),
  video_url: z.string().max(2000).nullish(),
  /** Legacy field: estimated % of image that is text. */
  image_text_percent: z.number().min(0).max(100).optional(),
});

const MAX_TEXT_IN_IMAGE_PERCENT = 20;

function severityToRisk(severity: PolicySeverity): 'low' | 'medium' | 'high' {
  if (severity === 'block') return 'high';
  if (severity === 'warn') return 'medium';
  return 'low';
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.format() },
      { status: 400 }
    );
  }

  // Coerce null → undefined for the scanner (it treats both as "absent").
  const { image_text_percent, ...rest } = parsed.data;
  const scanInput: PolicyScanInput = Object.fromEntries(
    Object.entries(rest).map(([k, v]) => [k, v ?? undefined])
  ) as PolicyScanInput;

  const result = scanCreative(scanInput);

  // Legacy image-text rule lives only on this endpoint (no creative field).
  if (image_text_percent != null && image_text_percent > MAX_TEXT_IN_IMAGE_PERCENT) {
    result.issues.push({
      code: 'image.text_overlay_excess',
      severity: 'warn',
      message: `Image is ~${image_text_percent}% text. Meta deprioritises ads above ${MAX_TEXT_IN_IMAGE_PERCENT}%. Reduce overlay text or move it to the primary_text instead.`,
      field: 'image_url',
    });
    if (result.severity === 'clean') result.severity = 'warn';
  }

  return Response.json({
    // New shape (preferred):
    severity: result.severity,
    issues: result.issues,
    blocked: result.blocked,
    scanned_at: result.scanned_at,
    // Backward-compatible envelope:
    risk_level: severityToRisk(result.severity),
    issues_text: result.issues.map((i) => i.message),
    message: result.blocked
      ? 'Ad content blocked due to policy violations. Fix the listed issues before deploying.'
      : result.issues.length > 0
        ? 'Some issues detected. Review before launch.'
        : 'Content looks good. Ready to deploy.',
  });
}
