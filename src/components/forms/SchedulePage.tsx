'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { CreateScheduleItemModal } from '@/components/modals/CreateScheduleItemModal';
import { useApi } from '@/hooks/useApi';
import { addDays, parseDateKey, startOfWeek, toDateKey } from '@/lib/date-utils';

type Guest = {
  id: string;
  guestId: string;
  firstName: string;
  lastName: string;
  roomNumber: string | null;
  status: string;
  vip: boolean;
};

type SelectedGuest = Guest & {
  stay?: {
    checkIn: string | null;
    checkOut: string | null;
  } | null;
};

type ScheduleItem = {
  id: string;
  guestId: string;
  title: string;
  itemType: 'RESERVATION' | 'ACTIVITY' | 'BOOKING' | 'ORDER' | 'SERVICE' | 'CUSTOM';
  sourceModule?: string;
  sourceRecordId?: string;
  startAt: string;
  endAt: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  color?: string;
};

type ScheduleResponse = {
  guests: Guest[];
  selectedGuest: SelectedGuest | null;
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  items: ScheduleItem[];
  totalActivities: number;
};

type CreateSlot = {
  guestId: string;
  startAt: string;
  endAt: string;
  itemType: ScheduleItem['itemType'];
  title: string;
};

const TIME_SLOTS = Array.from({ length: 15 }, (_, index) => index + 7);

function toDateInput(date: Date) {
  return toDateKey(date);
}

function formatWeekLabel(start: Date) {
  const end = addDays(start, 6);
  const formatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function formatGuestName(guest?: Guest | SelectedGuest | null) {
  if (!guest) return '';
  return `${guest.firstName} ${guest.lastName}`.trim();
}

function formatShortTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDayLabel(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
  }).format(value).toUpperCase();
}

function formatHourLabel(hour: number) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
  }).format(new Date(`1970-01-01T${String(hour).padStart(2, '0')}:00:00`));
}

function minuteOffset(value: string) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function calendarDateKey(value: string) {
  return value.slice(0, 10);
}

function shiftWeek(weekStart: string, direction: -1 | 1) {
  const date = new Date(`${weekStart}T12:00:00`);
  date.setDate(date.getDate() + direction * 7);
  return toDateInput(date);
}

function guestInitials(guest: Guest) {
  return `${guest.firstName.charAt(0)}${guest.lastName.charAt(0) || ''}`.toUpperCase();
}

function formatGuestStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function SchedulePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [weekStart, setWeekStart] = useState(() => toDateInput(startOfWeek(new Date())));
  const [selectedGuestId, setSelectedGuestId] = useState<string>('');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [slot, setSlot] = useState<CreateSlot | null>(null);

  const scheduleUrl = `/api/schedule?weekStart=${weekStart}${selectedGuestId ? `&guestId=${selectedGuestId}` : ''}`;
  const { data, isLoading, mutate } = useApi<ScheduleResponse>(scheduleUrl);

  // Auto-select first guest only on initial data load
  useEffect(() => {
    if (!hasInitialized && data?.guests?.length) {
      setSelectedGuestId(data.guests[0].id);
      setHasInitialized(true);
    }
  }, [data, hasInitialized]);

  useEffect(() => {
    const normalizedWeekStart = data?.weekStart?.slice(0, 10);
    if (normalizedWeekStart && normalizedWeekStart !== weekStart) {
      setWeekStart(normalizedWeekStart);
    }
  }, [data?.weekStart, weekStart]);

  const weekStartDate = parseDateKey(weekStart);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index));
  const selectedGuest: SelectedGuest | null =
    data?.selectedGuest ?? data?.guests?.find((guest) => guest.id === selectedGuestId) ?? null;
  const filteredGuests = (data?.guests ?? []).filter((guest) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return [guest.firstName, guest.lastName, guest.roomNumber ?? '', guest.guestId].join(' ').toLowerCase().includes(query);
  });

  const items = [...(data?.items ?? [])]
    .filter((item) => item.guestId === selectedGuestId)
    .sort((left, right) => {
      const startDiff = new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
      if (startDiff !== 0) return startDiff;
      return new Date(left.endAt).getTime() - new Date(right.endAt).getTime();
    });
  const reservationItems = items.filter((item) => item.itemType === 'RESERVATION');
  const timedItems = items.filter((item) => item.itemType !== 'RESERVATION');

  const eventsByDay = days.map((day) => {
    const dayKey = toDateInput(day);
    return timedItems
      .filter((item) => calendarDateKey(item.startAt) === dayKey)
      .sort((left, right) => {
        const startDiff = new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
        if (startDiff !== 0) return startDiff;
        return new Date(left.endAt).getTime() - new Date(right.endAt).getTime();
      });
  });

  const weekLabel = data?.weekLabel ?? formatWeekLabel(weekStartDate);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Guest Schedules"
        subtitle="Plan and manage daily itineraries"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-xl border border-border bg-surface shadow-sm">
              <button
                type="button"
                onClick={() => setWeekStart((current) => shiftWeek(current, -1))}
                className="rounded-l-xl px-3 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-surface-secondary"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setWeekStart(toDateInput(startOfWeek(new Date())))}
                className="inline-flex items-center gap-2 border-x border-border px-4 py-2 text-sm font-medium text-[var(--color-text-primary)]"
              >
                <CalendarDays className="h-4 w-4" />
                {weekLabel}
              </button>
              <button
                type="button"
                onClick={() => setWeekStart((current) => shiftWeek(current, 1))}
                className="rounded-r-xl px-3 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-surface-secondary"
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] shadow-sm transition-colors hover:bg-surface-secondary"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="card flex flex-col gap-4 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="input-field w-full pl-10 text-sm"
              placeholder="Search guests..."
            />
          </div>

            <div className="space-y-2 overflow-y-auto pr-1">
            {filteredGuests.map((guest) => {
              const active = guest.id === selectedGuestId;
              return (
<button
                  key={guest.id}
                  type="button"
                  onClick={() => setSelectedGuestId(guest.id)}
                  className={`relative w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                    active
                      ? 'border-border bg-surface-secondary shadow-sm before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-accent'
                      : 'border-border bg-surface hover:bg-surface-secondary'
                  }`} 
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {guestInitials(guest)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-[var(--color-text-primary)]">{formatGuestName(guest)}</div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {guest.roomNumber ? `Room ${guest.roomNumber}` : guest.guestId} · {formatGuestStatus(guest.status)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="card overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-border bg-surface px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-primary/10 text-lg font-semibold text-primary shadow-sm">
                {selectedGuest ? guestInitials(selectedGuest) : '?'}
              </div>
              <div>
                <h2 className="font-display text-2xl text-[var(--color-text-primary)]">
                  {selectedGuest ? formatGuestName(selectedGuest) : 'Select a guest'}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <span>{selectedGuest?.roomNumber ? `Room ${selectedGuest.roomNumber}` : 'No room linked'}</span>
                  {selectedGuest?.stay?.checkIn && selectedGuest?.stay?.checkOut ? (
                    <>
                      <span>•</span>
                      <span>
                        {new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' }).format(new Date(selectedGuest.stay.checkIn))}
                        {' '}
                        -{' '}
                        {new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' }).format(new Date(selectedGuest.stay.checkOut))}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-secondary px-4 py-3 text-center shadow-sm">
              <div className="text-3xl font-display text-[var(--color-text-primary)]">{data?.totalActivities ?? 0}</div>
              <div className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-text-secondary)]">Activities</div>
            </div>
          </div>

          {reservationItems.length > 0 ? (
            <div className="border-b border-border bg-surface px-5 py-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-text-secondary)]">Stays</div>
                  <div className="flex flex-wrap gap-3">
                {reservationItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm text-[var(--color-text-primary)] shadow-sm">
                    <div className="font-semibold text-[var(--color-text-primary)]">{item.title}</div>
                    <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(item.startAt))}
                      {' '}
                      -{' '}
                      {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(item.endAt))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
              <div className="min-w-[900px]">
              <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-border bg-surface">
                <div className="px-3 py-4 text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-text-secondary)]">Time</div>
                {days.map((day) => (
                    <div key={toDateInput(day)} className="border-l border-border px-3 py-4 text-center">
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-text-secondary)]">{formatDayLabel(day)}</div>
                    <div className="mt-1 text-sm text-[var(--color-text-primary)]">{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(day)}</div>
                  </div>
                ))}
              </div>

              <div className="relative grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
                <div className="relative border-r border-border bg-surface-secondary/40">
                  {TIME_SLOTS.map((hour) => (
                    <div key={hour} className="h-[72px] border-b border-border px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)]">
                      {formatHourLabel(hour)}
                    </div>
                  ))}
                </div>

                {days.map((day, dayIndex) => {
                  const dayItems = eventsByDay[dayIndex] ?? [];
                  const dayKey = toDateInput(day);
                  return (
                    <div key={dayKey} className="relative border-r border-border bg-surface" style={{ height: `${TIME_SLOTS.length * 72}px` }}>
                      {TIME_SLOTS.map((hour) => (
                        <button
                          key={`${dayKey}-${hour}`}
                          type="button"
                          onClick={() => {
                            if (!selectedGuestId) return;
                            const start = new Date(day);
                            start.setHours(hour, 0, 0, 0);
                            const end = new Date(start);
                            end.setHours(end.getHours() + 1);
                            setSlot({
                              guestId: selectedGuestId,
                              startAt: start.toISOString(),
                              endAt: end.toISOString(),
                              itemType: 'CUSTOM',
                              title: '',
                            });
                          }}
                          className="group absolute inset-x-0 h-[72px] border-b border-border text-left transition-colors hover:bg-primary/5"
                          style={{ top: `${(hour - TIME_SLOTS[0]) * 72}px` }}
                        >
                          <span className="absolute right-3 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-primary/20 bg-surface text-primary shadow-sm group-hover:flex">
                            <Plus className="h-4 w-4" />
                          </span>
                        </button>
                      ))}

                      {dayItems.map((item) => {
                        const startMinutes = minuteOffset(item.startAt);
                        const endMinutes = Math.max(minuteOffset(item.endAt), startMinutes + 45);
                        const top = ((startMinutes - TIME_SLOTS[0] * 60) / 60) * 72;
                        const height = Math.max(((endMinutes - startMinutes) / 60) * 72, 56);
                        return (
<button
                    key={item.id}
                    type="button"
                    className={`absolute left-2 right-2 z-10 rounded-xl border border-card-border px-3 py-2 text-left transition-transform`}
                    style={{ top: `${top}px`, height: `${height}px` }}
                  >
                            <div className="text-xs font-semibold text-[var(--color-text-primary)]">{item.title}</div>
                            <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                              {formatShortTime(item.startAt)} - {formatShortTime(item.endAt)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      <CreateScheduleItemModal
        isOpen={Boolean(slot)}
        onClose={() => setSlot(null)}
        slot={slot}
        guests={data?.guests ?? []}
        onCreated={() => {
          setSlot(null);
          void mutate();
        }}
      />

      {isLoading && <div className="card p-6 text-[var(--color-text-secondary)]">Loading schedule...</div>}
    </div>
  );
}
