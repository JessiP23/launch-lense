import { createServiceClient } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const db = createServiceClient();
  const { sprint_id } = await params;

  const { data: config, error } = await db
    .from('autopilot_configs')
    .select('*')
    .eq('sprint_id', sprint_id)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  }

  // If no config exists, return defaults
  if (!config) {
    return Response.json({
      enabled: false,
      daily_budget_cents: 5000,
      total_budget_cents: 50000,
      channels: [],
      auto_pause_on_underperform: true,
      auto_scale_on_overperform: false,
    });
  }

  return Response.json(config);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const db = createServiceClient();
  const { sprint_id } = await params;

  const body = await request.json();

  // Validate required fields
  if (typeof body.daily_budget_cents !== 'number' || body.daily_budget_cents <= 0) {
    return Response.json({ error: 'daily_budget_cents must be a positive integer', code: 'INVALID_INPUT' }, { status: 400 });
  }

  if (typeof body.total_budget_cents !== 'number' || body.total_budget_cents <= 0) {
    return Response.json({ error: 'total_budget_cents must be a positive integer', code: 'INVALID_INPUT' }, { status: 400 });
  }

  const { data: config, error } = await db
    .from('autopilot_configs')
    .upsert({
      sprint_id,
      daily_budget_cents: body.daily_budget_cents,
      total_budget_cents: body.total_budget_cents,
      enabled: body.enabled !== undefined ? body.enabled : false,
      target_cpa_cents: body.target_cpa_cents || null,
      target_ctr_floor: body.target_ctr_floor || null,
      channels: body.channels || [],
      auto_pause_on_underperform: body.auto_pause_on_underperform !== undefined ? body.auto_pause_on_underperform : true,
      auto_scale_on_overperform: body.auto_scale_on_overperform !== undefined ? body.auto_scale_on_overperform : false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'sprint_id' })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  }

  return Response.json(config);
}
