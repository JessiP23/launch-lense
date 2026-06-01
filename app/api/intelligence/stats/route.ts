import { createServiceClient } from '@/lib/supabase';
import { getAllBenchmarks } from '@/lib/signal-fabric';

// Module-level cache
let cachedStats: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  const db = createServiceClient();
  const now = Date.now();

  // Return cached result if fresh
  if (cachedStats && now - cacheTimestamp < CACHE_TTL) {
    return Response.json(cachedStats);
  }

  try {
    // Count total sprints where state = 'COMPLETE'
    const { count: totalSprints } = await db
      .from('sprints')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'COMPLETE');

    // Count where verdict->>'verdict' = 'GO'
    const { count: totalGoVerdicts } = await db
      .from('sprints')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'COMPLETE')
      .filter('verdict', 'cs', '{"verdict":"GO"}');

    // Count distinct genome->>'category' from sprints where state = 'COMPLETE'
    const { data: categories } = await db
      .from('sprints')
      .select('genome')
      .eq('state', 'COMPLETE')
      .not('genome', 'is', null);

    const distinctCategories = new Set(
      categories?.map((s: any) => s.genome?.market_category).filter(Boolean) || []
    );

    // Flywheel metrics
    const { count: totalSprintsInBenchmark } = await db
      .from('sprint_signals')
      .select('*', { count: 'exact', head: true });

    const benchmarks = await getAllBenchmarks();
    const verticalsCovered = new Set(
      benchmarks.filter((b) => b.sample_size >= 3).map((b) => b.vertical)
    ).size;

    // Calculate benchmark accuracy
    let benchmarkAccuracyPct = 0;
    let accuracyTrend: number[] = [];

    if (totalSprintsInBenchmark && totalSprintsInBenchmark > 0) {
      // Join sprints with sprint_signals to compare genome composite to actual verdict
      const { data: sprintsWithSignals } = await db
        .from('sprint_signals')
        .select('sprint_id, verdict, sprints!inner(genome, verdict)')
        .eq('verdict', 'GO');

      if (sprintsWithSignals) {
        let correct = 0;
        for (const s of sprintsWithSignals) {
          const composite = (s as any).sprints?.genome?.composite || 0;
          const actual = s.verdict;
          // Predicted GO if composite >= 70
          const predicted = composite >= 70 ? 'GO' : composite >= 40 ? 'ITERATE' : 'NO-GO';
          if (predicted === actual) correct++;
        }
        benchmarkAccuracyPct = (correct / sprintsWithSignals.length) * 100;
      }
    }

    // Data freshness: extract(days from now() - max(created_at)) from sprint_signals
    const { data: latestSignal } = await db
      .from('sprint_signals')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let dataFreshnessDays = 0;
    if (latestSignal?.created_at) {
      const diff = now - new Date(latestSignal.created_at).getTime();
      dataFreshnessDays = Math.floor(diff / (24 * 60 * 60 * 1000));
    }

    const stats = {
      total_sprints: totalSprints || 0,
      total_go_verdicts: totalGoVerdicts || 0,
      total_verticals_covered: distinctCategories.size,
      flywheel_metrics: {
        total_sprints_in_benchmark: totalSprintsInBenchmark || 0,
        verticals_covered: verticalsCovered,
        benchmark_accuracy_pct: Math.round(benchmarkAccuracyPct),
        accuracy_trend: accuracyTrend,
        data_freshness_days: dataFreshnessDays,
      },
    };

    // Update cache
    cachedStats = stats;
    cacheTimestamp = now;

    return Response.json(stats);
  } catch (error) {
    console.error('[intelligence/stats]', error);
    return Response.json({ error: 'Failed to fetch stats', code: 'DB_ERROR' }, { status: 500 });
  }
}
