'use client';

import { useMemo, useState } from 'react';
import { Check, Search, User } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { Guest } from '@/types';

type GuestSearchPickerProps = {
  selectedId: string;
  onSelect: (guest: Guest) => void;
  footer?: React.ReactNode;
  placeholder?: string;
};

export function GuestSearchPicker({
  selectedId,
  onSelect,
  footer,
  placeholder = 'Search registered guests by name or email...',
}: GuestSearchPickerProps) {
  const [search, setSearch] = useState('');
  const guestsUrl = useMemo(() => {
    const params = new URLSearchParams({ limit: '100' });
    if (search.trim()) params.set('search', search.trim());
    return `/api/guests?${params}`;
  }, [search]);

  const { data: guests, isLoading } = useApi<Guest[]>(guestsUrl);
  const rows = guests ?? [];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={placeholder}
          className="input-field w-full pl-10"
        />
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-[var(--color-text-secondary)]">Loading guests...</p>}
        {!isLoading && rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-border bg-surface-secondary/50 px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
            No guests match your search.
          </p>
        )}
        {rows.map((guest) => {
          const selected = guest.id === selectedId;
          return (
            <button
              key={guest.id}
              type="button"
              onClick={() => onSelect(guest)}
              className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
                selected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-surface hover:border-border hover:bg-surface-secondary'
              }`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--color-text-primary)]">
                  {guest.firstName} {guest.lastName}
                </p>
                <p className="truncate text-sm text-[var(--color-text-secondary)]">
                  {[guest.email, guest.phone].filter(Boolean).join(' • ') || 'No contact details'}
                </p>
              </div>
              {selected && <Check className="h-5 w-5 shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>

      {footer && <div className="border-t border-border pt-4 text-center text-sm text-[var(--color-text-secondary)]">{footer}</div>}
    </div>
  );
}
