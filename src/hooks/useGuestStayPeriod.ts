'use client';

import { useMemo } from 'react';
import { useApi } from '@/hooks/useApi';

type ReservationSummary = {
  id: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string | null;
};

export type GuestStayPeriod = {
  /** The stay itself — shown to staff so they know the guest's dates. */
  from: string;
  to: string;
  /**
   * Earliest day that can actually be booked: the later of check-in and
   * today. A stay that began last week is still current, but its past days
   * are not bookable — the API rejects any slot less than ten minutes away,
   * so offering them produced a booking that could only ever fail.
   */
  bookableFrom: string;
  /** Latest bookable day: the guest's check-out. */
  bookableTo: string;
  /** False once the whole stay is in the past. */
  hasBookableDays: boolean;
  status: string | null;
};

/** Today as a `YYYY-MM-DD` key in the browser's own timezone. */
export function todayKey() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * The stay a guest is currently on, used to bound date pickers so staff can
 * only book them for days they are actually at the hotel.
 *
 * Cancelled and no-show reservations are ignored. A checked-out stay is still
 * returned so that historical records remain viewable, but the caller decides
 * whether to allow booking against it.
 */
export function useGuestStayPeriod(guestId: string | null | undefined) {
  const { data, isLoading } = useApi<ReservationSummary[]>(
    guestId ? `/api/reservations?guestId=${guestId}` : null,
  );

  const stay = useMemo<GuestStayPeriod | null>(() => {
    const rows = (data ?? []).filter(
      (r) =>
        r.checkIn &&
        r.checkOut &&
        r.status !== 'CANCELLED' &&
        r.status !== 'NO_SHOW',
    );

    if (rows.length === 0) return null;

    // Prefer the stay the guest is on right now; otherwise the one starting
    // soonest, so a booking taken in advance lands on the upcoming stay
    // rather than an old one.
    const active =
      rows.find((r) => r.status === 'CHECKED_IN') ??
      rows
        .filter((r) => r.status !== 'CHECKED_OUT')
        .sort((a, b) => (a.checkIn ?? '').localeCompare(b.checkIn ?? ''))[0] ??
      rows[0];

    const from = active.checkIn as string;
    const to = active.checkOut as string;
    const bookableFrom = from > todayKey() ? from : todayKey();

    return {
      from,
      to,
      bookableFrom,
      bookableTo: to,
      hasBookableDays: bookableFrom <= to,
      status: active.status,
    };
  }, [data]);

  return { stay, isLoading: Boolean(guestId) && isLoading };
}

/** `12 Aug 2026` from a `YYYY-MM-DD` key, without timezone drift. */
export function formatStayDay(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  if (!year || !month || !day) return dayKey;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
