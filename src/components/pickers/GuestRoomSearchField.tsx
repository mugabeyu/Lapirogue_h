'use client';

import { useMemo, useState } from 'react';
import { Search, User, X } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { Guest } from '@/types';

type GuestRoomSearchFieldProps = {
  selectedGuest: Guest | null;
  onSelect: (guest: Guest | null) => void;
};

export function GuestRoomSearchField({ selectedGuest, onSelect }: GuestRoomSearchFieldProps) {
  const [search, setSearch] = useState('');

  const guestsUrl = useMemo(() => {
    const params = new URLSearchParams({ limit: '100' });
    if (search.trim()) params.set('search', search.trim());
    return `/api/guests?${params}`;
  }, [search]);

  const { data: guests, isLoading } = useApi<Guest[]>(guestsUrl);

  const filteredGuests = useMemo(() => {
    const rows = guests ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return rows.slice(0, 8);
    return rows.filter((guest) => {
      const name = `${guest.firstName} ${guest.lastName}`.toLowerCase();
      const room = guest.roomNumber?.toLowerCase() ?? '';
      const guestCode = guest.guestId?.toLowerCase() ?? '';
      return name.includes(query) || room.includes(query) || guestCode.includes(query);
    });
  }, [guests, search]);

  if (selectedGuest) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[var(--color-text-primary)]">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-[var(--color-text-primary)]">
                {selectedGuest.firstName} {selectedGuest.lastName}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {selectedGuest.roomNumber ? `Room ${selectedGuest.roomNumber}` : 'No room assigned'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="rounded-lg p-1 text-[var(--color-text-secondary)] hover:bg-surface hover:text-[var(--color-text-primary)]"
            aria-label="Clear guest"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search guest name or room..."
          className="input-field w-full pl-10"
        />
      </div>

      {(search.trim() || filteredGuests.length > 0) && (
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-sm">
          {isLoading && <p className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">Searching...</p>}
          {!isLoading && filteredGuests.length === 0 && (
            <p className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">No guests found.</p>
          )}
          {filteredGuests.map((guest) => (
            <button
              key={guest.id}
              type="button"
              onClick={() => {
                onSelect(guest);
                setSearch('');
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-secondary"
            >
              <span className="font-medium text-[var(--color-text-primary)]">
                {guest.firstName} {guest.lastName}
              </span>
              <span className="ml-auto text-[var(--color-text-secondary)]">
                {guest.roomNumber ? `Room ${guest.roomNumber}` : guest.guestId}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
