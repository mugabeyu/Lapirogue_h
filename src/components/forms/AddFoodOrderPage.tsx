'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Clock, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { GuestRoomSearchField } from '@/components/pickers/GuestRoomSearchField';
import { MENU_CATEGORIES, MenuItemRecord, formatMenuPrice } from '@/lib/menu';
import { Guest } from '@/types';
import { useApi } from '@/hooks/useApi';

type CartLine = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

const SERVICE_RATE = 0.1;
const VAT_RATE = 0.15;

const ORDER_MENU_CATEGORIES = ['All', ...MENU_CATEGORIES.filter((c) => c !== 'Local Specials'), 'Mains'] as const;

const TIME_SLOTS = [
  '09:00 AM', '10:30 AM', '12:00 PM', '02:00 PM',
  '04:00 PM', '04:30 PM', '06:00 PM',
];

export default function AddFoodOrderPage() {
  const router = useRouter();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [menuSearch, setMenuSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(todayStr);
  const [scheduledTime, setScheduledTime] = useState(TIME_SLOTS[0]);

  const menuUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (menuSearch.trim()) params.set('search', menuSearch.trim());
    if (category !== 'All') params.set('category', category === 'Mains' ? 'Lunch' : category);
    return `/api/menu-items?${params}`;
  }, [menuSearch, category]);

  const { data: menuItems } = useApi<MenuItemRecord[]>(menuUrl);
  const availableItems = (menuItems ?? []).filter((item) => item.isAvailable);

  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const serviceCharge = subtotal * SERVICE_RATE;
  const vat = (subtotal + serviceCharge) * VAT_RATE;
  const total = subtotal + serviceCharge + vat;

  function addToCart(item: MenuItemRecord) {
    setCart((current) => {
      const existing = current.find((line) => line.id === item.id);
      if (existing) {
        return current.map((line) =>
          line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  function updateQuantity(id: string, delta: number) {
    setCart((current) =>
      current
        .map((line) => (line.id === id ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  function parseTimeTo24(time12: string): string {
    const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return `${time12}:00`;
    let hour = parseInt(match[1], 10);
    const minute = match[2];
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:${minute}:00`;
  }

  async function handleAddOrder() {
    if (!selectedGuest) {
      toast.error('Search and select a guest first');
      return;
    }
    if (cart.length === 0) {
      toast.error('Add at least one menu item');
      return;
    }

    setIsSaving(true);

    const response = await fetch('/api/food-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestId: selectedGuest.id,
        items: cart.map((line) => ({
          id: line.id,
          name: line.name,
          quantity: line.quantity,
          price: line.price,
        })),
        subtotal,
        serviceCharge,
        taxAmount: vat,
        total,
        notes: `Service ${(SERVICE_RATE * 100).toFixed(0)}%, VAT ${(VAT_RATE * 100).toFixed(0)}%`,
        scheduledDate,
        scheduledTime: parseTimeTo24(scheduledTime),
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      const payload = await response.json();
      toast.error(payload.error ?? 'Unable to add order');
      return;
    }

    toast.success('Order added');
    router.push('/food-beverage/orders');
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 animate-in fade-in duration-500 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-4 flex items-center gap-3">
          <Link
            href="/food-beverage/orders"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to orders
          </Link>
        </div>

        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={menuSearch}
            onChange={(event) => setMenuSearch(event.target.value)}
            placeholder="Search menu items..."
            className="input-field w-full pl-10"
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {ORDER_MENU_CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  category === item
                    ? 'bg-primary text-white'
                    : 'border border-border bg-surface text-[var(--color-text-primary)] hover:bg-surface-secondary'
                }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {availableItems.map((item) => (
<button
               key={item.id}
               type="button"
               onClick={() => addToCart(item)}
               className="overflow-hidden rounded-xl border border-border bg-surface text-left shadow-sm transition-shadow hover:shadow-md"
             >
              <div className="aspect-[4/3] bg-surface-secondary">
                {item.imagePath ? (
                  <img src={item.imagePath} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-secondary)]">No photo</div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <span className="font-medium text-[var(--color-text-primary)]">{item.name}</span>
                <span className="shrink-0 font-semibold text-primary">{formatMenuPrice(item.price)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <aside className="w-full shrink-0 rounded-xl border border-border bg-surface p-5 shadow-sm lg:w-[360px]">
        <h2 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">Order Details</h2>

        <div className="mt-4">
          <GuestRoomSearchField selectedGuest={selectedGuest} onSelect={setSelectedGuest} />
        </div>

        <div className="mt-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Scheduled delivery</p>
          <div className="flex items-center gap-2 rounded-xl border border-border p-3">
            <Calendar className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text-primary)] outline-none [color-scheme:var(--color-scheme)]"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border p-3">
            <Clock className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
            <select
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text-primary)] outline-none"
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Current order</p>
          {cart.length === 0 && (
            <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-[var(--color-text-secondary)]">
              Tap menu items to add them here
            </p>
          )}
          {cart.map((line) => (
            <div key={line.id} className="flex items-center gap-2 rounded-xl border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{line.name}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{formatMenuPrice(line.price)}</p>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-secondary">
                <button
                  type="button"
                  onClick={() => updateQuantity(line.id, -1)}
                  className="p-1.5 text-[var(--color-text-secondary)] hover:text-primary"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-medium">{line.quantity}</span>
                <button
                  type="button"
                  onClick={() => updateQuantity(line.id, 1)}
                  className="p-1.5 text-[var(--color-text-secondary)] hover:text-primary"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <button type="button" onClick={() => updateQuantity(line.id, -line.quantity)} className="p-1 text-[var(--color-text-secondary)] hover:text-danger" aria-label="Remove item">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between text-[var(--color-text-secondary)]">
            <span>Subtotal</span>
            <span>{formatMenuPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[var(--color-text-secondary)]">
            <span>Service charge (10%)</span>
            <span>{formatMenuPrice(serviceCharge)}</span>
          </div>
          <div className="flex justify-between text-[var(--color-text-secondary)]">
            <span>VAT (15%)</span>
            <span>{formatMenuPrice(vat)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 font-display text-lg font-semibold text-primary">
            <span>Total</span>
            <span>{formatMenuPrice(total)}</span>
          </div>
        </div>

        <button
          type="button"
          disabled={isSaving}
          onClick={handleAddOrder}
          className="btn-primary mt-5 w-full disabled:opacity-50"
        >
          {isSaving ? 'Adding...' : 'Add Order'}
        </button>
      </aside>
    </div>
  );
}
