export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  try {
    // Fetch test details
    const { data: test, error: testError } = await supabase
      .from('tests')
      .select('id, name, status, campaign_id, ad_account_id, created_at')
      .eq('id', id)
      .single();

    if (testError || !test) {
      return Response.json({ error: 'Test not found' }, { status: 404 });
    }

    // Aggregate metrics from events table
    const { data: events } = await supabase
      .from('events')
      .select('payload')
      .eq('test_id', id)
      .eq('type', 'metrics')
      .order('created_at', { ascending: false });

    const latestPayload = events?.[0]?.payload as Record<string, number> | undefined;

    const metrics = {
      impressions: latestPayload?.impressions || 0,
      clicks: latestPayload?.clicks || 0,
      spend_cents: latestPayload?.spend_cents || 0,
      lp_views: latestPayload?.lp_views || 0,
      leads: latestPayload?.leads || 0,
      ctr: latestPayload?.ctr || 0,
      cpa_cents: latestPayload?.cpa_cents || 0,
    };

    // Fetch annotations
    const { data: annotations } = await supabase
      .from('annotations')
      .select('created_at, message')
      .eq('test_id', id)
      .order('created_at', { ascending: true });

    return Response.json({
      test_id: id,
      test: {
        name: test.name,
        status: test.status,
        campaign_id: test.campaign_id,
      },
      metrics,
      annotations: annotations || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[metrics] Error:', error);
    return Response.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
