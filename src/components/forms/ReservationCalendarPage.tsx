'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useApi } from '@/hooks/useApi';

type CalendarView = 'week' | 'month';

type CalendarBooking = {
  id: string;
  roomId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  displayStatus: 'confirmed' | 'checked-in' | 'pending' | 'departing' | 'cancelled';
};

type CalendarRoom = {
  id: string;
  roomNumber: string;
  type: string;
  subtitle?: string;
};

type CalendarRoomGroup = {
  type: string;
  label: string;
  rooms: CalendarRoom[];
};

type CalendarData = {
  anchor: string;
  view: CalendarView;
  today: string;
  start: string;
  end: string;
  label: string;
  days: string[];
  roomGroups: CalendarRoomGroup[];
  bookings: CalendarBooking[];
};

const STATUS_STYLES: Record<CalendarBooking['displayStatus'], string> = {
  confirmed: 'bg-primary text-white',
  'checked-in': 'bg-success text-white',
  pending: 'bg-warning text-[var(--color-text-primary)]',
  departing: 'bg-[#3B82B6] text-white',
  cancelled: 'bg-surface-secondary text-[var(--color-text-secondary)]',
};

const LEGEND = [
  { key: 'confirmed', label: 'Confirmed', className: STATUS_STYLES.confirmed },
  { key: 'checked-in', label: 'Checked-in', className: STATUS_STYLES['checked-in'] },
  { key: 'pending', label: 'Pending', className: STATUS_STYLES.pending },
  { key: 'departing', label: 'Departing Today', className: STATUS_STYLES.departing },
  { key: 'cancelled', label: 'Cancelled', className: STATUS_STYLES.cancelled },
] as const;

function shiftAnchor(anchor: string, view: CalendarView, direction: -1 | 1) {
  const date = new Date(anchor + 'T12:00:00');
  if (view === 'week') {
    date.setDate(date.getDate() + direction * 7);
  } else {
    date.setMonth(date.getMonth() + direction);
  }
  return date.toISOString().slice(0, 10);
}

function dayLabel(dateKey: string) {
  const date = new Date(dateKey + 'T12:00:00');
  return {
    weekday: date.toLocaleDateString('en-GB', { weekday: 'short' }),
    day: date.getDate(),
  };
}

function bookingPosition(booking: CalendarBooking, days: string[]) {
  const occupied = days.map((day) => day >= booking.checkIn && day < booking.checkOut);
  const first = occupied.indexOf(true);
  const last = occupied.lastIndexOf(true);
  if (first < 0) return null;

  const span = last - first + 1;
  const left = (first / days.length) * 100;
  const width = (span / days.length) * 100;
  return { left, width: Math.max(width, 100 / days.length) };
}

type ReservationCalendarPageProps = {
  embedded?: boolean;
};

export default function ReservationCalendarPage({ embedded = false }: ReservationCalendarPageProps) {
  const [view, setView] = useState<CalendarView>('month');
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));

  const url = useMemo(
    () => `/api/reservations/calendar?anchor=${anchor}&view=${view}`,
    [anchor, view],
  );
  const { data, isLoading } = useApi<CalendarData>(url);

  const bookingsByRoom = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const booking of data?.bookings ?? []) {
      if (!map.has(booking.roomId)) map.set(booking.roomId, []);
      map.get(booking.roomId)!.push(booking);
    }
    return map;
  }, [data?.bookings]);

  const days = data?.days ?? [];
  const dayColMin = view === 'week' ? 72 : 44;

  return (
    <div className={`space-y-6 ${embedded ? '' : 'animate-in fade-in duration-500'}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {!embedded ? (
          <div>
              <h1 className="font-display text-3xl text-[var(--color-text-primary)]">Reservation Calendar</h1>
          </div>
        ) : (
          <div>
              <h2 className="font-display text-2xl text-[var(--color-text-primary)]">Monthly reservations</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Room occupancy across the month</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-border bg-surface p-1 text-sm">
              <button
                type="button"
                onClick={() => setView('month')}
                className={`rounded-md px-4 py-1.5 font-medium transition-colors ${
                  view === 'month' ? 'bg-primary text-white' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
            >
              Month
            </button>
                <button
              type="button"
              onClick={() => setView('week')}
              className={`rounded-md px-4 py-1.5 font-medium transition-colors ${
                view === 'week' ? 'bg-primary text-white' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Week
            </button>
          </div>
          {!embedded ? (
            <Link href="/reservations/new" className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Reservation
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-border bg-surface p-2 hover:bg-surface-secondary"
            onClick={() => setAnchor((value) => shiftAnchor(value, view, -1))}
            aria-label="Previous period"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[140px] text-center font-display text-lg text-[var(--color-text-primary)]">
            {data?.label ?? '...'}
          </span>
          <button
            type="button"
            className="rounded-lg border border-border bg-surface p-2 hover:bg-surface-secondary"
            onClick={() => setAnchor((value) => shiftAnchor(value, view, 1))}
            aria-label="Next period"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          {LEGEND.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5 text-[var(--color-text-secondary)]">
              <span className={`h-2.5 w-2.5 rounded-full ${item.className.split(' ')[0]}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

          <div className="overflow-hidden rounded-[24px] border border-border bg-surface shadow-sm">
        {isLoading && <p className="p-8 text-sm text-[var(--color-text-secondary)]">Loading calendar...</p>}

        {!isLoading && data && (
          <div className="overflow-x-auto">
            <div
              className="grid min-w-max"
              style={{ gridTemplateColumns: `200px repeat(${days.length}, minmax(${dayColMin}px, 1fr))` }}
            >
              <div className="sticky left-0 z-20 border-b border-r border-border bg-surface-secondary px-4 py-3 text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
                Room
              </div>
              {days.map((dayKey) => {
                const { weekday, day } = dayLabel(dayKey);
                const isToday = dayKey === data.today;
                return (
                  <div
                    key={dayKey}
                    className={`border-b border-border px-1 py-3 text-center text-xs ${
                      isToday ? 'bg-primary/5' : 'bg-surface-secondary'
                    }`}
                  >
                    <div className="text-[var(--color-text-secondary)]">{weekday}</div>
                    <div
                      className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                        isToday ? 'bg-surface-secondary text-[var(--color-text-primary)]' : 'text-[var(--color-text-primary)]'
                      }`}
                    >
                      {day}
                    </div>
                  </div>
                );
              })}

              {data.roomGroups.map((group) => (
                <GroupRows
                  key={group.type}
                  group={group}
                  days={days}
                  bookingsByRoom={bookingsByRoom}
                  dayColMin={dayColMin}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupRows({
  group,
  days,
  bookingsByRoom,
}: {
  group: CalendarRoomGroup;
  days: string[];
  bookingsByRoom: Map<string, CalendarBooking[]>;
  dayColMin: number;
}) {
  return (
    <>
      <div
        className="col-span-full border-b border-border bg-surface-secondary/80 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]"
        style={{ gridColumn: `1 / span ${days.length + 1}` }}
      >
        {group.label}
      </div>
      {group.rooms.map((room) => {
        const bookings = bookingsByRoom.get(room.id) ?? [];
        return (
          <div key={room.id} className="contents">
            <div className="sticky left-0 z-10 border-b border-r border-border bg-surface px-4 py-4">
              <p className="font-medium text-[var(--color-text-primary)]">Room {room.roomNumber}</p>
              {room.subtitle && <p className="text-xs text-[var(--color-text-secondary)]">{room.subtitle}</p>}
              {!room.subtitle && (
                <p className="text-xs text-[var(--color-text-secondary)]">{room.type.replace('_', ' ')}</p>
              )}
            </div>
            <div
              className="relative border-b border-border bg-surface"
              style={{ gridColumn: `span ${days.length}` }}
            >
              <div
                className="grid h-14"
                style={{ gridTemplateColumns: `repeat(${days.length}, minmax(44px, 1fr))` }}
              >
                {days.map((dayKey) => (
                  <div key={dayKey} className="border-r border-border last:border-r-0" />
                ))}
              </div>
              <div className="absolute inset-y-2 left-0 right-0">
                {bookings.map((booking) => {
                  const position = bookingPosition(booking, days);
                  if (!position) return null;
                  const { left, width } = position;
                  return (
                    <div
                      key={booking.id}
                      className={`absolute top-0 flex h-10 items-center overflow-hidden rounded-md px-2 text-xs font-medium shadow-sm ${STATUS_STYLES[booking.displayStatus]}`}
                      style={{ left: `${left}%`, width: `calc(${width}% - 4px)`, marginLeft: 2 }}
                      title={`${booking.guestName} · ${booking.checkIn} to ${booking.checkOut}`}
                    >
                      <span className="truncate">{booking.guestName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

