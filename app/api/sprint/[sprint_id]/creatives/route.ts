// ─────────────────────────────────────────────────────────────────────────────
// GET    /api/sprint/[sprint_id]/creatives           — list all creatives
// POST   /api/sprint/[sprint_id]/creatives           — upsert one creative
//
// The upsert is keyed by (sprint_id, angle_id, platform). This is the editor
// autosave target: the canvas debounces field edits and POSTs the full row.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { listCreatives, upsertCreative } from '@/lib/creatives/store';

const PlatformSchema = z.enum(['meta', 'google', 'linkedin', 'tiktok']);

// All editable fields are optional individually so partial autosave bodies
// from the canvas still work. The server merges them into the existing row.
const UpsertSchema = z.object({
  angle_id: z.string().min(1),
  platform: PlatformSchema,
  headline: z.string().max(2000).nullish(),
  primary_text: z.string().max(20000).nullish(),
  description: z.string().max(2000).nullish(),
  cta: z.string().max(120).nullish(),
  display_link: z.string().max(2000).nullish(),
  hook: z.string().max(2000).nullish(),
  overlay_text: z.string().max(2000).nullish(),
  callout: z.string().max(2000).nullish(),
  audience_label: z.string().max(2000).nullish(),
  image_url: z.string().max(8192).nullish(),
  video_url: z.string().max(8192).nullish(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;
  try {
    const rows = await listCreatives(sprint_id);
    return Response.json({ creatives: rows });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to list creatives' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;

  let raw: unknown;
  try { raw = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = UpsertSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const row = await upsertCreative({ sprint_id, ...parsed.data });
    return Response.json({ creative: row });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to upsert creative' },
      { status: 500 }
    );
  }
}
