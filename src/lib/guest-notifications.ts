import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Guest-facing notifications. Every row written here shows up in the guest's
 * mobile app inbox, so the copy is written for the guest — not for staff.
 *
 * Failures are swallowed on purpose: a notification is a side effect of the
 * action the guest asked for, and losing one must never roll back or fail the
 * booking/payment/order that triggered it.
 */

export type GuestNotificationCategory =
  | 'Reservation'
  | 'Stay'
  | 'Room'
  | 'Payment'
  | 'Order'
  | 'Activity'
  | 'Account'
  | 'General';

export async function notifyGuest(params: {
  guestId: string | null | undefined;
  title: string;
  message: string;
  category?: GuestNotificationCategory;
}) {
  if (!params.guestId) return;

  try {
    await getSupabaseAdmin().from('notifications').insert({
      guest_id: params.guestId,
      title: params.title,
      message: params.message,
      category: params.category ?? 'General',
    });
  } catch (error) {
    console.warn('Guest notification could not be created:', error);
  }
}

export async function notifyGuestMany(
  notifications: Array<{
    guestId: string | null | undefined;
    title: string;
    message: string;
    category?: GuestNotificationCategory;
  }>,
) {
  const rows = notifications
    .filter((n) => Boolean(n.guestId))
    .map((n) => ({
      guest_id: n.guestId as string,
      title: n.title,
      message: n.message,
      category: n.category ?? 'General',
    }));

  if (rows.length === 0) return;

  try {
    await getSupabaseAdmin().from('notifications').insert(rows);
  } catch (error) {
    console.warn('Guest notifications could not be created:', error);
  }
}

/**
 * Dates are stored as plain `YYYY-MM-DD` day keys. Formatting them via
 * `new Date(...)` would shift them across a timezone boundary for guests west
 * of UTC, so the parts are read directly off the string instead.
 */
export function formatStayDate(dayKey: string | null | undefined) {
  if (!dayKey) return '—';

  const [year, month, day] = dayKey.split('-').map(Number);
  if (!year || !month || !day) return dayKey;

  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function describeStayPeriod(checkIn: string, checkOut: string) {
  return `${formatStayDate(checkIn)} → ${formatStayDate(checkOut)}`;
}
