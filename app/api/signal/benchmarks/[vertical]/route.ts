// ─────────────────────────────────────────────────────────────────────────────
// GET /api/signal/benchmarks/[vertical]
//
// Fetches benchmarks for a specific vertical from the Signal Fabric.
// This is a server-side endpoint to avoid exposing service role keys to the client.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vertical: string }> }
) {
  try {
    const { vertical } = await params;
    const db = createServiceClient();
    const { data, error } = await db
      .from('signal_benchmarks')
      .select('*')
      .eq('vertical', vertical);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ benchmarks: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch benchmarks' },
      { status: 500 }
    );
  }
}
