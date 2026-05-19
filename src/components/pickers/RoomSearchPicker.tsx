'use client';

import { useMemo, useState } from 'react';
import { BedDouble, Check, Search } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { Room } from '@/types';

type RoomSearchPickerProps = {
  selectedId: string;
  onSelect: (room: Room) => void;
  checkIn?: string;
  checkOut?: string;
  compact?: boolean;
};

export function RoomSearchPicker({
  selectedId,
  onSelect,
  checkIn,
  checkOut,
  compact = false,
}: RoomSearchPickerProps) {
  const [search, setSearch] = useState('');
  const roomsUrl = useMemo(() => {
    if (checkIn && checkOut) {
      return `/api/rooms?checkIn=${checkIn}&checkOut=${checkOut}`;
    }
    return '/api/rooms?limit=100';
  }, [checkIn, checkOut]);

  const { data: rooms, isLoading } = useApi<Room[]>(roomsUrl);

  const filtered = useMemo(() => {
    const list = rooms ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter(
      (room) =>
        room.roomNumber.toLowerCase().includes(query) ||
        room.type.toLowerCase().includes(query) ||
        (room.floor ?? '').toLowerCase().includes(query),
    );
  }, [rooms, search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search rooms by number or type..."
          className={`input-field w-full pl-9 ${compact ? 'py-1.5 text-sm' : ''}`}
        />
      </div>

      <div className={`max-h-48 space-y-2 overflow-y-auto ${compact ? '' : 'max-h-64'}`}>
        {isLoading && <p className="text-xs text-ink-500">Loading rooms...</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-xs text-ink-500">
            {checkIn && checkOut ? 'No rooms available for these dates.' : 'No rooms found.'}
          </p>
        )}
        {filtered.map((room) => {
          const selected = room.id === selectedId;
          return (
            <button
              key={room.id}
              type="button"
              onClick={() => onSelect(room)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selected
                  ? 'border-primary bg-primary/5'
                  : 'border-sand-200 hover:border-sand-300 hover:bg-sand-50/50'
              }`}
            >
              <BedDouble className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 font-medium text-ink-900">
                Room {room.roomNumber}
                <span className="font-normal text-ink-500"> · {room.type.replace('_', ' ')}</span>
              </span>
              <span className="text-xs text-ink-600">Rs {room.price.toLocaleString()}</span>
              {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
