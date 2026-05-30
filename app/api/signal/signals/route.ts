// ─────────────────────────────────────────────────────────────────────────────
// GET /api/signal/signals?limit=20
//
// Fetches recent sprint signals from the Signal Fabric.
// This is a server-side endpoint to avoid exposing service role keys to the client.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const db = createServiceClient();
    const { data, error } = await db
      .from('sprint_signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ signals: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch sprint signals' },
      { status: 500 }
    );
  }
}
