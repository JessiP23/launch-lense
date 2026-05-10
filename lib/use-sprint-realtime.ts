'use client';

/**
 * Subscribes to Supabase Realtime for the sprints table.
 * Calls `onUpdate(rawRow)` whenever the sprint row changes.
 * Returns a boolean indicating whether the channel is live.
 *
 * Usage:
 *   useSprintRealtime(activeSprint, (raw) => setSprintData(normalizeSprint(raw)))
 */
import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getBrowserSupabase } from '@/lib/supabase-browser';

export function useSprintRealtime(
  sprintId: string | null,
  onUpdate: (raw: Record<string, unknown>) => void,
): { isLive: boolean } {
  const [isLive, setIsLive] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!sprintId) {
      setIsLive(false);
      return;
    }

    let supabase: ReturnType<typeof getBrowserSupabase>;
    try {
      supabase = getBrowserSupabase();
    } catch {
      return; // env vars not configured — fall back to polling
    }

    const channelName = `sprint-row:${sprintId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sprints',
          filter: `id=eq.${sprintId}`,
        },
        (payload) => {
          onUpdateRef.current(payload.new as Record<string, unknown>);
        },
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
      setIsLive(false);
    };
  }, [sprintId]);

  return { isLive };
}
