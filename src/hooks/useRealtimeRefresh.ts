'use client';

import { useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

type RefreshHandler = () => void | Promise<unknown>;

/**
 * Re-runs `onChange` whenever one of `tables` changes in Postgres.
 *
 * The dashboard reads through SWR with revalidation switched off, so without
 * this a receptionist's screen keeps showing whatever was true when the page
 * loaded — including after a colleague or the guest's own app has moved a
 * booking. Pass SWR's `mutate` as `onChange` to pull the fresh row in.
 *
 * Changes are coalesced on a short timer because one desk action (moving a
 * stay, checking a guest in) usually writes several rows, and each write
 * would otherwise trigger its own refetch.
 */
export function useRealtimeRefresh(
  tables: string[],
  onChange: RefreshHandler,
  options?: { enabled?: boolean; debounceMs?: number },
) {
  const enabled = options?.enabled ?? true;
  const debounceMs = options?.debounceMs ?? 400;

  // Kept in a ref so an inline arrow function from the caller does not tear
  // down and rebuild the subscription on every render.
  const handlerRef = useRef(onChange);
  handlerRef.current = onChange;

  const tableKey = tables.join(',');

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void handlerRef.current();
      }, debounceMs);
    };

    const channelName = `dashboard:${tableKey}:${Math.random().toString(36).slice(2)}`;
    let channel = supabase.channel(channelName);

    for (const table of tableKey.split(',')) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        scheduleRefresh,
      );
    }

    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
    // `tables` is an array literal at most call sites, so the joined string is
    // what actually identifies the subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey, enabled, debounceMs]);
}
