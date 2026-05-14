export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const db = createServiceClient();
  const { data, error } = await db
    .from('data_deletion_requests')
    .select('confirmation_id, status, source, created_at, completed_at')
    .eq('confirmation_id', code)
    .maybeSingle();

  if (error || !data) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({
    confirmation_code: data.confirmation_id,
    status: data.status,
    source: data.source,
    created_at: data.created_at,
    completed_at: data.completed_at,
  });
}
