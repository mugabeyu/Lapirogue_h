export const ACTIVITY_CATEGORIES = [
  'Water Sports',
  'Island Tours',
  'Wellness & Spa',
  'Cultural',
  'Entertainment',
  'Adventure',
] as const;

export type ActivityListItem = {
  id: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  duration: number;
  durationLabel: string;
  capacity: number;
  capacityLabel: string;
  meetingPoint?: string;
  requiresAdvanceBooking: boolean;
  weatherDependent: boolean;
  suitableForChildren: boolean;
  defaultTime: string;
  status: string;
  imagePath?: string;
  nextSession?: { date: string; time: string | null; label: string } | null;
  /** Non-cancelled bookings referencing this activity; blocks deletion. */
  activeBookingCount?: number;
};

export const SESSION_COLOR_STYLES: Record<string, string> = {
  water: 'border border-border bg-surface-secondary text-[var(--color-text-primary)]',
  tours: 'border border-border bg-surface-secondary text-[var(--color-text-primary)]',
  spa: 'border border-border bg-surface-secondary text-[var(--color-text-primary)]',
  cultural: 'border border-border bg-surface-secondary text-[var(--color-text-primary)]',
  adventure: 'border border-border bg-surface-secondary text-[var(--color-text-primary)]',
};

export const TIME_SLOTS = [
  '09:00 AM',
  '10:30 AM',
  '12:00 PM',
  '02:00 PM',
  '04:00 PM',
  '04:30 PM',
  '06:00 PM',
];

export const PICKUP_POINTS = ['Hotel Lobby', 'Beach Hut', 'Pool Deck', 'Marina Pier'];

/**
 * Registration closes this long before a session starts, so a guest is not
 * signed up for something already under way.
 */
export const REGISTRATION_CUTOFF_MS = 10 * 60 * 1000;

/** `'02:00 PM'` -> `'14:00:00'`. Returns null if the slot is unparseable. */
export function parseTimeSlot(timeSlot?: string | null) {
  const trimmed = timeSlot?.trim();
  if (!trimmed) return null;

  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match12) {
    let hour = Number(match12[1]) % 12;
    if (match12[4].toUpperCase() === 'PM') hour += 12;
    return `${String(hour).padStart(2, '0')}:${match12[2]}:${match12[3] ?? '00'}`;
  }
  if (/^\d{2}:\d{2}(?::\d{2})?$/.test(trimmed)) {
    const [h, m, s] = trimmed.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s ?? '00'}`;
  }
  return null;
}

/**
 * Whether a session is too close to start (or already past) to register for.
 *
 * Shared by the API and the booking form so the dropdown cannot offer a slot
 * the server will then refuse — the mismatch is what produced a bare 409 with
 * no way to tell which field was wrong.
 */
export function isWithinRegistrationCutoff(date: string, timeSlot?: string | null) {
  const parsedTime = parseTimeSlot(timeSlot);
  if (!parsedTime) return false;

  const scheduledAt = new Date(`${date}T${parsedTime}`);
  if (Number.isNaN(scheduledAt.getTime())) return false;

  return scheduledAt.getTime() - Date.now() < REGISTRATION_CUTOFF_MS;
}

export function formatRs(price: number) {
  if (price <= 0) return 'Complimentary';
  return `Rs ${price.toLocaleString('en-IN')}`;
}

export function formatTime12(time24: string) {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}
