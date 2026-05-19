export const MENU_CATEGORIES = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Beverages',
  'Cocktails',
  'Snacks',
  'Local Specials',
] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number];

export type MenuItemRecord = {
  id: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  preparationMinutes?: number | null;
  isAvailable: boolean;
  imagePath?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function formatMenuPrice(price: number) {
  return `Rs ${price.toLocaleString('en-IN')}`;
}

export function formatPrepTime(minutes?: number | null) {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}
