/**
 * When staff may still cancel something on a guest's behalf.
 *
 * Kept in one place so the button state in the UI and the check in the API
 * can never disagree — a disabled button that the server would have allowed
 * (or worse, an enabled one it rejects) is how these rules drift apart.
 */

/**
 * An activity cannot be cancelled once it is about to start: the guide has
 * a headcount by then and the place cannot be resold.
 */
export const ACTIVITY_CANCELLATION_CUTOFF_MINUTES = 30;

/** Roles permitted to cancel a guest's booking or order. */
export const CANCELLATION_ROLES = ['MANAGER'] as const;

export function canRoleCancel(role: string | null | undefined) {
  return Boolean(role && (CANCELLATION_ROLES as readonly string[]).includes(role));
}

/**
 * Combines a `YYYY-MM-DD` day key and an `HH:MM[:SS]` time into a Date in the
 * server's local zone. Both apps store these as separate plain columns.
 */
export function sessionStartsAt(date: string, time?: string | null) {
  if (!date) return null;

  const raw = (time ?? '').trim() || '00:00:00';
  const withSeconds = /^\d{1,2}:\d{2}$/.test(raw) ? `${raw}:00` : raw.slice(0, 8);
  const parsed = new Date(`${date}T${withSeconds}`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export type CancellationCheck =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Whether an activity booking can still be cancelled.
 *
 * `now` is injectable so the rule can be tested at a fixed instant rather
 * than depending on when the suite happens to run.
 */
export function canCancelActivityBooking(params: {
  status?: string | null;
  date: string;
  time?: string | null;
  now?: Date;
}): CancellationCheck {
  const status = (params.status ?? '').toUpperCase();

  if (status === 'CANCELLED') {
    return { allowed: false, reason: 'This booking is already cancelled.' };
  }
  if (status === 'COMPLETED') {
    return { allowed: false, reason: 'This activity has already taken place.' };
  }

  const startsAt = sessionStartsAt(params.date, params.time);
  if (!startsAt) return { allowed: true };

  const now = params.now ?? new Date();
  const minutesUntilStart = (startsAt.getTime() - now.getTime()) / 60_000;

  if (minutesUntilStart < ACTIVITY_CANCELLATION_CUTOFF_MINUTES) {
    return {
      allowed: false,
      reason:
        minutesUntilStart < 0
          ? 'This activity has already started.'
          : `Cancellations close ${ACTIVITY_CANCELLATION_CUTOFF_MINUTES} minutes before the activity starts.`,
    };
  }

  return { allowed: true };
}

/**
 * Whether a food order can still be cancelled. Orders have no start time, so
 * the kitchen's progress is the cutoff: once it has been served there is
 * nothing left to call off.
 */
export function canCancelFoodOrder(status?: string | null): CancellationCheck {
  const value = (status ?? '').toUpperCase();

  if (value === 'CANCELLED') {
    return { allowed: false, reason: 'This order is already cancelled.' };
  }
  if (value === 'SERVED') {
    return { allowed: false, reason: 'This order has already been served.' };
  }

  return { allowed: true };
}
