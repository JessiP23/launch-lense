import { getAllBenchmarks } from '@/lib/signal-fabric';

// Module-level cache
let cachedBenchmarks: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  const now = Date.now();

  // Return cached result if fresh
  if (cachedBenchmarks && now - cacheTimestamp < CACHE_TTL) {
    return Response.json(cachedBenchmarks);
  }

  try {
    const benchmarks = await getAllBenchmarks();

    // Update cache
    cachedBenchmarks = benchmarks;
    cacheTimestamp = now;

    return Response.json(benchmarks);
  } catch (error) {
    console.error('[intelligence/benchmarks]', error);
    return Response.json({ error: 'Failed to fetch benchmarks', code: 'DB_ERROR' }, { status: 500 });
  }
}
