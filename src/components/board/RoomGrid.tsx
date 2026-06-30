'use client';

import { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { RoomCard } from './RoomCard';
import type { Room } from '@/types';

interface RoomGridProps {
  rooms: Room[];
  isDragging: boolean;
  dragOverRoomId: string | null;
  onDragOver: (e: React.DragEvent, roomId: string) => void;
  onDragEnter: (e: React.DragEvent, roomId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, roomId: string) => void;
}

export function RoomGrid({
  rooms,
  isDragging,
  dragOverRoomId,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
}: RoomGridProps) {
  const floors = useMemo(() => {
    const map = new Map<string, Room[]>();
    for (const room of rooms) {
      const floor = room.floor ?? '1';
      if (!map.has(floor)) map.set(floor, []);
      map.get(floor)!.push(room);
    }
    const sorted = Array.from(map.entries());
    sorted.sort(([a], [b]) => Number(a) - Number(b));
    return sorted;
  }, [rooms]);

  const sortedFloors = useMemo(() => {
    return floors
      .map(([floor, floorRooms]) => ({
        floor,
        rooms: [...floorRooms].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })),
      }));
  }, [floors]);

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-secondary/50 px-4 py-12 text-center">
        <Building2 className="mb-3 h-10 w-10 text-[var(--color-text-secondary)]" />
        <p className="text-sm text-[var(--color-text-secondary)]">No rooms found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedFloors.map(({ floor, rooms: floorRooms }) => (
        <section key={floor}>
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[var(--color-text-secondary)]" />
            <h3 className="font-display text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Floor {floor}
            </h3>
            <span className="text-xs text-[var(--color-text-secondary)]">
              ({floorRooms.length} {floorRooms.length === 1 ? 'room' : 'rooms'})
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {floorRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                isDragOver={dragOverRoomId === room.id}
                isDragging={isDragging}
                onDragOver={(e) => onDragOver(e, room.id)}
                onDragEnter={(e) => onDragEnter(e, room.id)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, room.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
