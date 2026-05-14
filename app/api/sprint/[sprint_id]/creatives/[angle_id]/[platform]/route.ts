// ─────────────────────────────────────────────────────────────────────────────
// GET   /api/sprint/[sprint_id]/creatives/[angle_id]/[platform]
// PATCH /api/sprint/[sprint_id]/creatives/[angle_id]/[platform]
//
// PATCH is the field-level autosave endpoint. It merges only the keys the
// caller sends, so the canvas can debounce per-field without losing other
// edits. Editing an 'approved' row automatically demotes it to 'reviewing'
// (handled inside lib/creatives/store.patchCreative).
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCreative, patchCreative } from '@/lib/creatives/store';
import type { Platform } from '@/lib/agents/types';

const PlatformSchema = z.enum(['meta', 'google', 'linkedin', 'tiktok']);

const PatchSchema = z.object({
  headline: z.string().max(2000).nullish(),
  primary_text: z.string().max(20000).nullish(),
  description: z.string().max(2000).nullish(),
  cta: z.string().max(120).nullish(),
  display_link: z.string().max(2000).nullish(),
  hook: z.string().max(2000).nullish(),
  overlay_text: z.string().max(2000).nullish(),
  callout: z.string().max(2000).nullish(),
  audience_label: z.string().max(2000).nullish(),
  // Accepts an http(s) URL or an inline data: URL. We cap at ~8 MB of
  // base64 (~11 M chars) so a phone photo fits without needing a separate
  // upload-to-storage round trip. The deployer rehosts to Meta or Supabase
  // Storage before launch; on-disk inline blobs are an editor convenience.
  image_url: z.string().max(11_000_000).nullish(),
  video_url: z.string().max(11_000_000).nullish(),
}).partial();

type RouteParams = { sprint_id: string; angle_id: string; platform: string };

function parsePlatform(raw: string): Platform | null {
  const r = PlatformSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const { sprint_id, angle_id, platform } = await params;
  const p = parsePlatform(platform);
  if (!p) return Response.json({ error: 'Invalid platform' }, { status: 400 });

  try {
    const row = await getCreative(sprint_id, angle_id, p);
    if (!row) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ creative: row });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to read creative' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const { sprint_id, angle_id, platform } = await params;
  const p = parsePlatform(platform);
  if (!p) return Response.json({ error: 'Invalid platform' }, { status: 400 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const row = await patchCreative(sprint_id, angle_id, p, parsed.data);
    return Response.json({ creative: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to patch creative';
    // patchCreative throws on illegal status — surface as 409 for the UI.
    const status = /cannot edit/.test(msg) || /not found/.test(msg) ? 409 : 500;
    return Response.json({ error: msg }, { status });
  }
}
