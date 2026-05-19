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
};

export const SESSION_COLOR_STYLES: Record<string, string> = {
  water: 'border-blue-200 bg-blue-50/90 text-blue-950',
  tours: 'border-orange-200 bg-orange-50/90 text-orange-950',
  spa: 'border-purple-200 bg-purple-50/90 text-purple-950',
  cultural: 'border-pink-200 bg-pink-50/90 text-pink-950',
  adventure: 'border-emerald-200 bg-emerald-50/90 text-emerald-950',
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
