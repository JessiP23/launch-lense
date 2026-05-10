'use client';

/**
 * Browser-side Supabase client.
 * Uses the anon key (safe to expose — RLS protects the data).
 * Required for Realtime subscriptions, which cannot run server-side.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _browser: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (!_browser) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set for browser Realtime',
      );
    }
    _browser = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return _browser;
}
