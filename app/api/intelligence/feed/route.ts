import { createServiceClient } from '@/lib/supabase';

export async function GET() {
  const db = createServiceClient();

  try {
    // Get last 20 rows from sprint_signals joined with sprints
    const { data: signals, error } = await db
      .from('sprint_signals')
      .select(`
        sprint_id,
        vertical,
        channel,
        ctr,
        cpc,
        cvr,
        cpa,
        verdict,
        angle_archetype,
        created_at,
        sprints (idea)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[intelligence/feed]', error);
      return Response.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
    }

    // Anonymize ideas by taking left 4 words + '...'
    const feed = (signals || []).map((row: any) => ({
      sprint_id: row.sprint_id,
      vertical: row.vertical,
      channel: row.channel,
      ctr: row.ctr,
      cpc: row.cpc,
      cvr: row.cvr,
      cpa: row.cpa,
      verdict: row.verdict,
      angle_archetype: row.angle_archetype,
      created_at: row.created_at,
      idea_preview: row.sprints?.idea 
        ? row.sprints.idea.split(' ').slice(0, 4).join(' ') + '...' 
        : 'Unknown idea',
    }));

    return Response.json(feed);
  } catch (error) {
    console.error('[intelligence/feed]', error);
    return Response.json({ error: 'Failed to fetch feed', code: 'DB_ERROR' }, { status: 500 });
  }
}
