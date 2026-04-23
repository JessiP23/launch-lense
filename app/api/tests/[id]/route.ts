/**
 * GET /api/tests/[id]
 * Returns the test row. Used by the setup page to load idea + genome context.
 * Gracefully handles missing columns (idea, genome_result) by retrying with minimal select.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  // Try full select first
  const { data: test, error } = await supabase
    .from('tests')
    .select('id, name, idea, status, genome_result, created_at')
    .eq('id', id)
    .single();

  if (!error && test) {
    return Response.json({ test });
  }

  // If columns missing, fall back to minimal select
  const { data: minimal, error: minErr } = await supabase
    .from('tests')
    .select('id, name, status, created_at')
    .eq('id', id)
    .single();

  if (minErr || !minimal) {
    return Response.json({ error: 'Test not found' }, { status: 404 });
  }

  return Response.json({
    test: {
      id: minimal.id,
      name: minimal.name,
      idea: minimal.name, // fallback: use name as idea
      status: minimal.status,
      genome_result: null,
    },
  });
}
