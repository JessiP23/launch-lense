import { NextRequest } from 'next/server';
import { getDemoMetrics } from '@/lib/healthgate';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isDemo = request.nextUrl.searchParams.get('demo') === '1';

  if (isDemo) {
    const createdAt = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const metrics = getDemoMetrics(createdAt);

    return Response.json({
      test_id: id,
      metrics,
      demo: true,
      timestamp: new Date().toISOString(),
    });
  }

  // Production: fetch from events table
  try {
    return Response.json({
      test_id: id,
      metrics: null,
      message: 'Production mode not configured',
    });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
