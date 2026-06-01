// GET /api/intelligence/stats — Fetch flywheel metrics for data flywheel
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  const db = createServiceClient();
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Check subscription status here
    // For now, allow access - replace with actual subscription check
    // const hasSubscription = await checkUserSubscription(userId);
    // if (!hasSubscription) {
    //   return Response.json({ error: 'Subscription required', hasAccess: false }, { status: 403 });
    // }

    // Compute flywheel metrics from signal fabric tables
    const { data: benchmarks } = await db
      .from('signal_benchmarks')
      .select('vertical, sample_size');

    const { data: signals } = await db
      .from('sprint_signals')
      .select('signal_strength, created_at');

    const { data: sprints } = await db
      .from('sprints')
      .select('id, genome, verdict, updated_at')
      .eq('state', 'COMPLETE');

    // total_sprints_in_benchmark: sum of all sample_sizes from signal_benchmarks
    const totalSprintsInBenchmark = benchmarks?.reduce((sum: number, b: any) => sum + (b.sample_size || 0), 0) || 0;

    // verticals_covered: count distinct verticals with >= 3 sprints
    const verticalCounts = benchmarks?.reduce((acc: Record<string, number>, b: any) => {
      acc[b.vertical] = (acc[b.vertical] || 0) + (b.sample_size || 0);
      return acc;
    }, {}) || {};
    const verticalsCovered = Object.values(verticalCounts).filter((count: number) => count >= 3).length;

    // best_covered_vertical: vertical with most sprint data
    const bestCoveredVertical = Object.entries(verticalCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // data_freshness_days: days since last sprint completed
    const lastSprint = sprints && sprints.length > 0
      ? sprints.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
      : null;
    const dataFreshnessDays = lastSprint
      ? Math.floor((Date.now() - new Date(lastSprint.updated_at).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // benchmark_accuracy_pct: % of sprints where Genome prediction matched actual verdict
    // This is a simplified calculation - in production you'd compare genome.composite with verdict.verdict
    let accuracyCount = 0;
    let totalWithVerdict = 0;
    sprints?.forEach((sprint: any) => {
      const genome = sprint.genome as any;
      const verdict = sprint.verdict as any;
      if (genome && verdict) {
        totalWithVerdict++;
        // Simplified: if composite >= 70 and verdict is GO, or composite < 70 and verdict is NO-GO/ITERATE
        const genomePositive = genome.composite >= 70;
        const verdictPositive = verdict.verdict === 'GO';
        if (genomePositive === verdictPositive) {
          accuracyCount++;
        }
      }
    });
    const benchmarkAccuracyPct = totalWithVerdict > 0 ? (accuracyCount / totalWithVerdict) * 100 : 0;

    // accuracy_trend: compare last 30 days vs prior 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    let recentAccuracyCount = 0;
    let recentTotal = 0;
    let priorAccuracyCount = 0;
    let priorTotal = 0;

    sprints?.forEach((sprint: any) => {
      const genome = sprint.genome as any;
      const verdict = sprint.verdict as any;
      const updatedAt = new Date(sprint.updated_at);
      
      if (genome && verdict) {
        const genomePositive = genome.composite >= 70;
        const verdictPositive = verdict.verdict === 'GO';
        const isAccurate = genomePositive === verdictPositive;

        if (updatedAt >= thirtyDaysAgo) {
          recentTotal++;
          if (isAccurate) recentAccuracyCount++;
        } else if (updatedAt >= sixtyDaysAgo) {
          priorTotal++;
          if (isAccurate) priorAccuracyCount++;
        }
      }
    });

    const recentAccuracy = recentTotal > 0 ? (recentAccuracyCount / recentTotal) * 100 : 0;
    const priorAccuracy = priorTotal > 0 ? (priorAccuracyCount / priorTotal) * 100 : 0;

    let accuracyTrend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (recentAccuracy > priorAccuracy + 5) {
      accuracyTrend = 'improving';
    } else if (recentAccuracy < priorAccuracy - 5) {
      accuracyTrend = 'degrading';
    }

    const flywheelMetrics = {
      total_sprints_in_benchmark: totalSprintsInBenchmark,
      verticals_covered: verticalsCovered,
      benchmark_accuracy_pct: Math.round(benchmarkAccuracyPct),
      accuracy_trend: accuracyTrend,
      best_covered_vertical: bestCoveredVertical,
      data_freshness_days: dataFreshnessDays,
    };

    return Response.json({ 
      flywheel_metrics: flywheelMetrics,
      hasAccess: true,
    });
  } catch (err) {
    console.error('[GET /api/intelligence/stats]', err);
    return Response.json({ error: 'Failed to fetch flywheel metrics' }, { status: 500 });
  }
}
