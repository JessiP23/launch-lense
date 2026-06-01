import { createServiceClient } from '@/lib/supabase';

export async function GET() {
  const db = createServiceClient();

  try {
    // Get total count of completed sprints
    const { count: totalSprints } = await db
      .from('sprints')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'COMPLETE');

    // If total sprints < 10, return insufficient data
    if (!totalSprints || totalSprints < 10) {
      return Response.json({ insufficient_data: true, current_count: totalSprints || 0 });
    }

    // Calculate weekly accuracy for the last 12 weeks
    const weeks: Array<{ week_start: string; accuracy_pct: number; sprint_count: number }> = [];
    
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      // Get sprints completed in this week
      const { data: weekSprints } = await db
        .from('sprints')
        .select('id, genome, verdict')
        .eq('state', 'COMPLETE')
        .gte('created_at', weekStart.toISOString())
        .lt('created_at', weekEnd.toISOString());

      if (!weekSprints || weekSprints.length === 0) {
        weeks.push({
          week_start: weekStart.toISOString(),
          accuracy_pct: 0,
          sprint_count: 0,
        });
        continue;
      }

      // Calculate accuracy for this week
      let correct = 0;
      for (const sprint of weekSprints) {
        const composite = sprint.genome?.composite || 0;
        const actualVerdict = sprint.verdict?.verdict;
        
        // Predicted verdict based on composite
        const predicted = composite >= 70 ? 'GO' : composite >= 40 ? 'ITERATE' : 'NO-GO';
        
        if (predicted === actualVerdict) {
          correct++;
        }
      }

      weeks.push({
        week_start: weekStart.toISOString(),
        accuracy_pct: Math.round((correct / weekSprints.length) * 100),
        sprint_count: weekSprints.length,
      });
    }

    return Response.json({ weeks });
  } catch (error) {
    console.error('[intelligence/accuracy]', error);
    return Response.json({ error: 'Failed to fetch accuracy data', code: 'DB_ERROR' }, { status: 500 });
  }
}
