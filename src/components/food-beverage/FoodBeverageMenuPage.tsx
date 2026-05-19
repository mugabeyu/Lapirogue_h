'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Clock, Pencil, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { MenuItemModal } from '@/components/modals/MenuItemModal';
import {
  MENU_CATEGORIES,
  MenuItemRecord,
  formatMenuPrice,
  formatPrepTime,
} from '@/lib/menu';
import { toast } from 'sonner';

type MenuResponse = {
  success: boolean;
  data: MenuItemRecord[];
  categories?: string[];
};

async function fetchMenu(url: string) {
  const response = await fetch(url);
  return response.json() as Promise<MenuResponse>;
}

function MenuItemCard({
  item,
  onEdit,
  onToggleAvailability,
}: {
  item: MenuItemRecord;
  onEdit: () => void;
  onToggleAvailability: () => void;
}) {
  const prepLabel = formatPrepTime(item.preparationMinutes);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] bg-sand-200">
        {item.imagePath ? (
          <img src={item.imagePath} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-500">No photo</div>
        )}
        {!item.isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-900/40">
            <span className="rounded-full bg-white/95 px-4 py-1.5 text-sm font-semibold text-ink-800">
              Out of Stock
            </span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-ink-700 shadow-sm">
          {item.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold leading-tight text-ink-900">{item.name}</h3>
          <p className="shrink-0 font-display text-lg font-semibold text-ink-900">{formatMenuPrice(item.price)}</p>
        </div>

        {item.description && (
          <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-ink-600">{item.description}</p>
        )}

        {prepLabel && (
          <p className="mb-3 flex items-center gap-1.5 text-xs text-ink-500">
            <Clock className="h-3.5 w-3.5" />
            Prep {prepLabel}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-sand-200 pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                item.isAvailable ? 'bg-primary' : 'bg-sand-300'
              }`}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={item.isAvailable}
                onChange={onToggleAvailability}
              />
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  item.isAvailable ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </span>
            {item.isAvailable ? 'Available' : 'Unavailable'}
          </label>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-sand-100 hover:text-primary"
            aria-label={`Edit ${item.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function FoodBeverageMenuPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MenuItemRecord | null>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (category !== 'All') params.set('category', category);
    return `/api/menu-items?${params}`;
  }, [search, category]);

  const { data, isLoading, mutate } = useSWR(url, fetchMenu);
  const items = data?.data ?? [];

  const categories = useMemo(() => {
    const fromApi = data?.categories ?? [];
    return ['All', ...MENU_CATEGORIES, ...fromApi.filter((c) => !MENU_CATEGORIES.includes(c as (typeof MENU_CATEGORIES)[number]))];
  }, [data?.categories]);

  const uniqueCategories = Array.from(new Set(categories));

  async function handleToggleAvailability(item: MenuItemRecord) {
    const response = await fetch('/api/menu-items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, isAvailable: !item.isAvailable }),
    });

    if (!response.ok) {
      toast.error('Unable to update availability');
      return;
    }

    await mutate();
  }

  function openCreate() {
    setEditItem(null);
    setModalOpen(true);
  }

  function openEdit(item: MenuItemRecord) {
    setEditItem(item);
    setModalOpen(true);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Food & Beverage Menu"
        subtitle="Manage restaurant and room service offerings"
        action={
          <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        }
      />

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search menu items..."
          className="input-field w-full pl-10"
        />
      </div>

      <div className="flex flex-wrap gap-6 border-b border-sand-200">
        {uniqueCategories.map((item) => {
          const active = item === category;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-600 hover:text-ink-900'
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>

      {isLoading && <p className="text-sm text-ink-500">Loading menu...</p>}

      {!isLoading && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-sand-200 bg-white px-6 py-16 text-center">
          <p className="text-ink-600">No menu items found.</p>
          <button type="button" onClick={openCreate} className="mt-4 text-sm font-semibold text-primary">
            Add your first item →
          </button>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {items.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            onEdit={() => openEdit(item)}
            onToggleAvailability={() => handleToggleAvailability(item)}
          />
        ))}
      </div>

      <MenuItemModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditItem(null);
        }}
        editItem={editItem}
        onSaved={() => {
          void mutate();
        }}
      />
    </div>
  );
}
