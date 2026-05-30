// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/policy/rules/[rule_id]/activate/[version]
// Activates a specific version of a policy rule and deactivates others
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

type RouteParams = { rule_id: string; version: string };

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { rule_id, version } = await params;
    const versionNum = parseInt(version, 10);

    if (isNaN(versionNum)) {
      return NextResponse.json({ error: 'Invalid version number' }, { status: 400 });
    }

    const db = createServiceClient();
    const { error } = await db.rpc('activate_rule_version', {
      rule_id_param: rule_id,
      version_param: versionNum,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, rule_id, version: versionNum });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to activate rule version' },
      { status: 500 }
    );
  }
}
