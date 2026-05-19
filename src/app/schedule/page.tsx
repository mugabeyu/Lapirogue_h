'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Plus, Search, Clock3 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { useApi } from '@/hooks/useApi';

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

function buildMonday(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toTimeInput(date: Date) {
  return date.toTimeString().slice(0, 5);
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
  return new Date(value).toISOString().slice(0, 10);
}

function getColor(item: ScheduleItem) {
  return item.color ?? '#D8C7A8';
}

export default function SchedulePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [weekStart, setWeekStart] = useState(() => toDateInput(buildMonday(new Date())));
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [slot, setSlot] = useState<CreateSlot | null>(null);

  const scheduleUrl = `/api/schedule?weekStart=${weekStart}${selectedGuestId ? `&guestId=${selectedGuestId}` : ''}`;
  const { data, isLoading, mutate } = useApi<ScheduleResponse>(scheduleUrl);

  useEffect(() => {
    if (!selectedGuestId && data?.guests?.length) {
      setSelectedGuestId(data.guests[0].id);
    }
  }, [data, selectedGuestId]);

  useEffect(() => {
    if (data?.selectedGuest?.id && data.selectedGuest.id !== selectedGuestId) {
      setSelectedGuestId(data.selectedGuest.id);
    }
  }, [data, selectedGuestId]);

  const weekStartDate = new Date(`${weekStart}T00:00:00`);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index));
  const selectedGuest: SelectedGuest | null =
    data?.selectedGuest ?? data?.guests?.find((guest) => guest.id === selectedGuestId) ?? null;
  const filteredGuests = (data?.guests ?? []).filter((guest) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return [guest.firstName, guest.lastName, guest.roomNumber ?? '', guest.guestId].join(' ').toLowerCase().includes(query);
  });

  const items = (data?.items ?? []).filter((item) => item.guestId === selectedGuestId || !selectedGuestId);
  const reservationItems = items.filter((item) => item.itemType === 'RESERVATION');
  const timedItems = items.filter((item) => item.itemType !== 'RESERVATION');

  const eventsByDay = days.map((day) => {
    const dayKey = toDateInput(day);
    return timedItems.filter((item) => calendarDateKey(item.startAt) === dayKey);
  });

  const weekLabel = data?.weekLabel ?? formatWeekLabel(weekStartDate);

  async function handleCreateItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot) return;

    const formData = new FormData(event.currentTarget);
    const response = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestId: formData.get('guestId') || slot.guestId,
        title: formData.get('title'),
        itemType: formData.get('itemType'),
        startAt: `${formData.get('date')}T${formData.get('startTime')}:00`,
        endAt: `${formData.get('date')}T${formData.get('endTime')}:00`,
        notes: formData.get('notes'),
        sourceModule: 'manual',
      }),
    });

    if (response.ok) {
      setSlot(null);
      await mutate();
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 page-padding">
      <PageHeader
        title="Daily Schedules"
        subtitle="Plan and manage guest itineraries directly from the weekly calendar."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setWeekStart(toDateInput(buildMonday(new Date()))) }
              className="inline-flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-4 py-2 text-sm font-medium text-ink-800 shadow-sm transition-colors hover:bg-sand-50"
            >
              <CalendarDays className="h-4 w-4" />
              {weekLabel}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-4 py-2 text-sm font-medium text-ink-800 shadow-sm transition-colors hover:bg-sand-50"
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
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
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
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                    active
                      ? 'border-primary/20 bg-primary/5 shadow-sm'
                      : 'border-sand-200 bg-white hover:bg-sand-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sand-200 text-sm font-semibold text-ink-700">
                      {guest.firstName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-ink-900">{formatGuestName(guest)}</div>
                      <div className="text-xs text-ink-500">
                        {guest.roomNumber ? `Room ${guest.roomNumber}` : guest.guestId} · {guest.status.replace('_', ' ').toLowerCase()}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="card overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-sand-200 bg-white px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-sand-200 bg-white text-xl font-semibold text-primary shadow-sm">
                {selectedGuest ? selectedGuest.firstName.charAt(0) : '?'}
              </div>
              <div>
                <h2 className="font-display text-2xl text-ink-900">
                  {selectedGuest ? formatGuestName(selectedGuest) : 'Select a guest'}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-600">
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

            <div className="rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-center shadow-sm">
              <div className="text-3xl font-display text-ink-900">{data?.totalActivities ?? 0}</div>
              <div className="text-xs font-medium uppercase tracking-[0.22em] text-ink-500">Activities</div>
            </div>
          </div>

          <div className="border-b border-sand-200 bg-sand-50/60 px-5 py-3 text-sm text-ink-600">
            Week view: {weekLabel}
          </div>

          {reservationItems.length > 0 ? (
            <div className="border-b border-sand-200 bg-white px-5 py-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-ink-500">Stays</div>
              <div className="flex flex-wrap gap-3">
                {reservationItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-sm text-ink-700 shadow-sm">
                    <div className="font-semibold text-ink-900">{item.title}</div>
                    <div className="mt-1 text-xs text-ink-500">
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
              <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-sand-200 bg-white">
                <div className="px-3 py-4 text-xs font-medium uppercase tracking-[0.22em] text-ink-400">Time</div>
                {days.map((day) => (
                  <div key={day.toISOString()} className="border-l border-sand-200 px-3 py-4 text-center">
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-500">{formatDayLabel(day)}</div>
                    <div className="mt-1 text-sm text-ink-700">{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(day)}</div>
                  </div>
                ))}
              </div>

              <div className="relative grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
                <div className="relative border-r border-sand-200 bg-sand-50/40">
                  {TIME_SLOTS.map((hour) => (
                    <div key={hour} className="h-[72px] border-b border-sand-200 px-3 py-2 text-xs font-medium text-ink-500">
                      {formatHourLabel(hour)}
                    </div>
                  ))}
                </div>

                {days.map((day, dayIndex) => {
                  const dayItems = eventsByDay[dayIndex] ?? [];
                  return (
                    <div key={day.toISOString()} className="relative border-r border-sand-200 bg-white" style={{ height: `${TIME_SLOTS.length * 72}px` }}>
                      {TIME_SLOTS.map((hour) => (
                        <button
                          key={`${day.toISOString()}-${hour}`}
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
                          className="group absolute inset-x-0 h-[72px] border-b border-sand-200/90 text-left transition-colors hover:bg-primary/5"
                          style={{ top: `${(hour - TIME_SLOTS[0]) * 72}px` }}
                        >
                          <span className="absolute right-3 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-primary/20 bg-white text-primary shadow-sm group-hover:flex">
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
                            className="absolute left-2 right-2 z-10 rounded-2xl border px-3 py-2 text-left shadow-sm transition-transform hover:-translate-y-0.5"
                            style={{ top, height, backgroundColor: `${getColor(item)}22`, borderColor: getColor(item) }}
                          >
                            <div className="text-xs font-semibold text-ink-900">{item.title}</div>
                            <div className="mt-1 text-[11px] text-ink-600">
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

      <Modal
        isOpen={Boolean(slot)}
        onClose={() => setSlot(null)}
        title="Create schedule item"
        subtitle="Add a reservation, activity, booking, order, or custom service entry for the selected guest."
        size="lg"
      >
        <form className="space-y-4" onSubmit={handleCreateItem}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">Guest</label>
              <select name="guestId" defaultValue={slot?.guestId ?? ''} className="input-field w-full" required>
                {(data?.guests ?? []).map((guest) => (
                  <option key={guest.id} value={guest.id}>
                    {formatGuestName(guest)}{guest.roomNumber ? ` · Room ${guest.roomNumber}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">Type</label>
              <select name="itemType" defaultValue={slot?.itemType ?? 'CUSTOM'} className="input-field w-full" required>
                <option value="RESERVATION">Reservation</option>
                <option value="ACTIVITY">Activity</option>
                <option value="BOOKING">Booking</option>
                <option value="ORDER">Order</option>
                <option value="SERVICE">Service</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Title</label>
            <input name="title" defaultValue={slot?.title ?? ''} required className="input-field w-full" placeholder="Spa treatment, dinner booking, room transfer..." />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">Date</label>
              <input name="date" type="date" defaultValue={slot ? calendarDateKey(slot.startAt) : ''} required className="input-field w-full" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">Start time</label>
              <input name="startTime" type="time" defaultValue={slot ? toTimeInput(new Date(slot.startAt)) : '09:00'} required className="input-field w-full" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">End time</label>
              <input name="endTime" type="time" defaultValue={slot ? toTimeInput(new Date(slot.endAt)) : '10:00'} required className="input-field w-full" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Notes</label>
            <textarea name="notes" rows={3} className="input-field w-full" placeholder="Optional notes for the guest schedule item" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setSlot(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save item
            </button>
          </div>
        </form>
      </Modal>

      {isLoading && <div className="card p-6 text-ink-600">Loading schedule...</div>}
    </div>
  );
}
