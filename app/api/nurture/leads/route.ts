import { createServiceClient } from '@/lib/supabase';

export async function GET(request: Request) {
  const db = createServiceClient();

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const source = url.searchParams.get('source');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    let query = db
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    if (source) {
      query = query.eq('source', source);
    }

    const { data: leads, error } = await query;

    // If table doesn't exist yet (migration not run), return empty results gracefully
    if (error && error.code === '42P01') {
      return Response.json({
        leads: [],
        total: 0,
      });
    }

    if (error) {
      return Response.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
    }

    const { count } = await db
      .from('leads')
      .select('*', { count: 'exact', head: true });

    return Response.json({
      leads: leads || [],
      total: count || 0,
    });
  } catch (error) {
    console.error('[nurture/leads]', error);
    return Response.json({ error: 'Failed to fetch leads', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
