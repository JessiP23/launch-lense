import { createServiceClient } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const db = createServiceClient();
  const { sprint_id } = await params;

  const url = new URL(request.url);
  const channel = url.searchParams.get('channel');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  let query = db
    .from('autopilot_decisions')
    .select('*')
    .eq('sprint_id', sprint_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (channel) {
    query = query.eq('channel', channel);
  }

  const { data: decisions, error } = await query;

  if (error) {
    return Response.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  }

  // Calculate total count
  const { count } = await db
    .from('autopilot_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('sprint_id', sprint_id);

  return Response.json({
    decisions: decisions || [],
    total: count || 0,
  });
}
