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
