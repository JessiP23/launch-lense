// ─────────────────────────────────────────────────────────────────────────────
// GET /api/policy/rules - List all policy rules with their active versions
// POST /api/policy/rules - Create a new rule version
// PUT /api/policy/rules/[rule_id]/activate - Activate a specific version
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

// GET: List all policy rules with their active versions
export async function GET(req: NextRequest) {
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from('policy_rules')
      .select('*')
      .eq('active', true)
      .order('rule_id', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rules: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch policy rules' },
      { status: 500 }
    );
  }
}

// POST: Create a new rule version
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rule_id, rule_definition, severity, created_by, notes } = body;

    if (!rule_id || !rule_definition || !severity) {
      return NextResponse.json(
        { error: 'Missing required fields: rule_id, rule_definition, severity' },
        { status: 400 }
      );
    }

    if (!['block', 'warn', 'clean'].includes(severity)) {
      return NextResponse.json(
        { error: 'Invalid severity. Must be one of: block, warn, clean' },
        { status: 400 }
      );
    }

    const db = createServiceClient();
    const { data, error } = await db.rpc('create_rule_version', {
      rule_id_param: rule_id,
      rule_definition_param: rule_definition,
      severity_param: severity,
      created_by_param: created_by || null,
      notes_param: notes || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rule: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create rule version' },
      { status: 500 }
    );
  }
}
