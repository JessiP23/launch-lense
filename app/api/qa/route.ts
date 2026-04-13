export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const checks: Check[] = [];
  let permissions: string[] = [];

  // 1. Required env vars
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'AD_ACCESS_TOKEN',
    'NEXT_PUBLIC_META_APP_ID',
    'META_APP_SECRET',
    'GROQ_API_KEY',
    'CRON_SECRET',
    'META_WEBHOOK_VERIFY_TOKEN',
    'NEXT_PUBLIC_APP_URL',
  ];

  for (const v of requiredEnvVars) {
    const present = !!process.env[v];
    checks.push({
      name: `env:${v}`,
      pass: present,
      detail: present ? 'set' : 'MISSING',
    });
  }

  // 2. Supabase connectivity — select from ad_accounts
  try {
    const { data, error } = await supabaseAdmin
      .from('ad_accounts')
      .select('id')
      .limit(1);
    if (error) throw error;
    checks.push({
      name: 'supabase:select',
      pass: true,
      detail: `OK — ${data.length} row(s) returned`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    checks.push({
      name: 'supabase:select',
      pass: false,
      detail: msg,
    });
  }

  // 3. Meta API — GET /me with token
  const token = process.env.AD_ACCESS_TOKEN;
  if (token) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/me?access_token=${token}`,
      );
      const json = await res.json();
      if (json.error) {
        checks.push({
          name: 'meta:get_me',
          pass: false,
          detail: json.error.message,
        });
      } else {
        checks.push({
          name: 'meta:get_me',
          pass: true,
          detail: `OK — id=${json.id}, name=${json.name ?? 'N/A'}`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      checks.push({
        name: 'meta:get_me',
        pass: false,
        detail: msg,
      });
    }
  } else {
    checks.push({
      name: 'meta:get_me',
      pass: false,
      detail: 'Skipped — AD_ACCESS_TOKEN not set',
    });
  }

  // 4. Meta API — GET ad account info
  if (token) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/act_727146616453623?fields=name,account_status&access_token=${token}`,
      );
      const json = await res.json();
      if (json.error) {
        checks.push({
          name: 'meta:ad_account',
          pass: false,
          detail: json.error.message,
        });
      } else {
        checks.push({
          name: 'meta:ad_account',
          pass: true,
          detail: `OK — name="${json.name}", status=${json.account_status}`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      checks.push({
        name: 'meta:ad_account',
        pass: false,
        detail: msg,
      });
    }
  } else {
    checks.push({
      name: 'meta:ad_account',
      pass: false,
      detail: 'Skipped — AD_ACCESS_TOKEN not set',
    });
  }

  if (token) {
    try {
      const perms = await fetch(
        `https://graph.facebook.com/v20.0/me/permissions?access_token=${token}`,
      );
      const permData = await perms.json() as {
        data?: Array<{ permission: string; status: string }>;
        error?: { message?: string };
      };
      if (permData.error) {
        throw new Error(permData.error.message || 'Failed to load token permissions');
      }
      const required = ['ads_management', 'ads_read', 'business_management', 'pages_show_list', 'pages_read_engagement'];
      const missing = required.filter((p) => !(permData.data || []).find((d) => d.permission === p && d.status === 'granted'));
      if (missing.length) {
        throw new Error(`Token missing: ${missing.join(',')}`);
      }
      permissions = required.filter((p) => (permData.data || []).find((d) => d.permission === p && d.status === 'granted'));
      checks.push({
        name: 'meta:permissions',
        pass: true,
        detail: `OK — granted: ${permissions.join(', ')}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      checks.push({
        name: 'meta:permissions',
        pass: false,
        detail: msg,
      });
    }
  } else {
    checks.push({
      name: 'meta:permissions',
      pass: false,
      detail: 'Skipped — AD_ACCESS_TOKEN not set',
    });
  }

  // 5. CRON_SECRET present (already checked in env, but verify non-empty)
  const cronOk = (process.env.CRON_SECRET ?? '').length >= 8;
  checks.push({
    name: 'cron_secret:strength',
    pass: cronOk,
    detail: cronOk ? 'OK — 8+ chars' : 'WEAK or MISSING — should be at least 8 chars',
  });

  // 6. Groq API — lightweight check
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      });
      checks.push({
        name: 'groq:api',
        pass: res.ok,
        detail: res.ok ? 'OK — API reachable' : `HTTP ${res.status}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      checks.push({
        name: 'groq:api',
        pass: false,
        detail: msg,
      });
    }
  } else {
    checks.push({
      name: 'groq:api',
      pass: false,
      detail: 'Skipped — GROQ_API_KEY not set',
    });
  }

  const allPass = checks.every((c) => c.pass);

  return NextResponse.json({ pass: allPass, checks, permissions }, { status: allPass ? 200 : 503 });
}
