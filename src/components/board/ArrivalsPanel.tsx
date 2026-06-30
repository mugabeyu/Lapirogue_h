'use client';

import { CalendarDays, User, Users } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { Reservation } from '@/types';

interface ArrivalsPanelProps {
  arrivals: Reservation[];
  isLoading: boolean;
  onDragStart: (e: React.DragEvent, arrival: Reservation) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ArrivalsPanel({ arrivals, isLoading, onDragStart, onDragEnd }: ArrivalsPanelProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 h-4 w-32 rounded bg-surface-secondary" />
            <div className="h-3 w-48 rounded bg-surface-secondary" />
          </div>
        ))}
      </div>
    );
  }

  if (arrivals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-secondary/50 px-4 py-10 text-center">
        <CalendarDays className="mb-3 h-10 w-10 text-[var(--color-text-secondary)]" />
        <p className="text-sm font-medium text-[var(--color-text-primary)]">No arrivals today</p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          All confirmed reservations have been checked in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {arrivals.map((arrival) => {
        const guest = arrival.guest;
        return (
          <div
            key={arrival.id}
            draggable
            onDragStart={(e) => onDragStart(e, arrival)}
            onDragEnd={onDragEnd}
            className="cursor-grab rounded-xl border border-border bg-surface p-4 shadow-sm transition-all active:cursor-grabbing hover:border-primary/50 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                  <p className="truncate font-medium text-[var(--color-text-primary)]">
                    {guest ? `${guest.firstName} ${guest.lastName}` : 'Unknown Guest'}
                  </p>
                </div>
                {guest?.email && (
                  <p className="mt-0.5 truncate pl-6 text-xs text-[var(--color-text-secondary)]">
                    {guest.email}
                  </p>
                )}
              </div>
              <StatusBadge status={arrival.status} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(arrival.checkIn)} – {formatDate(arrival.checkOut)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {arrival.adults} adult{arrival.adults !== 1 ? 's' : ''}
                {arrival.children > 0 && `, ${arrival.children} child${arrival.children !== 1 ? 'ren' : ''}`}
              </span>
            </div>

            {arrival.room && (
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                Previously assigned: Room {arrival.room.roomNumber}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
