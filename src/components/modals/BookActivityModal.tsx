'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { GuestSearchPicker } from '@/components/pickers/GuestSearchPicker';
import { formatStayDay, useGuestStayPeriod } from '@/hooks/useGuestStayPeriod';
import { useApi } from '@/hooks/useApi';
import {
  ActivityListItem,
  PICKUP_POINTS,
  TIME_SLOTS,
  formatRs,
  isWithinRegistrationCutoff,
} from '@/lib/activities';
import { Guest } from '@/types';
import { toast } from 'sonner';

interface BookActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: ActivityListItem;
  guestId?: string;
  onBooked?: () => void;
}

export function BookActivityModal({ isOpen, onClose, activity, guestId, onBooked }: BookActivityModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState(activity.defaultTime ? formatDefaultTime(activity.defaultTime) : '09:00 AM');
  const [participants, setParticipants] = useState(2);
  const [pickupPoint, setPickupPoint] = useState(PICKUP_POINTS[0]);
  const [notes, setNotes] = useState('');

  const guestSelectedId = selectedGuest?.id ?? guestId ?? '';
  const { stay, isLoading: isLoadingStay } = useGuestStayPeriod(guestSelectedId);

  // Places left on this specific session, so staff can see whether the party
  // fits before submitting rather than being rejected afterwards.
  const { data: availability, isLoading: isLoadingAvailability } =
    useApi<{ capacity: number; booked: number; remaining: number }>(
      date
        ? `/api/activities/availability?activityId=${activity.id}&date=${date}&time=${encodeURIComponent(timeSlot)}`
        : null,
    );

  const remaining = availability?.remaining;
  const exceedsRemaining =
    remaining !== undefined && participants > remaining;

  // On today's date the earlier sessions have already started, and the API
  // refuses anything inside the cutoff. Offering them anyway is what produced
  // a booking that failed on submit with no indication of which field to fix.
  const selectableSlots = useMemo(
    () => (date ? TIME_SLOTS.filter((slot) => !isWithinRegistrationCutoff(date, slot)) : TIME_SLOTS),
    [date],
  );

  // Keep the selection on a slot that is still open once the date changes.
  useEffect(() => {
    if (selectableSlots.length === 0) return;
    if (!selectableSlots.includes(timeSlot)) setTimeSlot(selectableSlots[0]);
  }, [selectableSlots, timeSlot]);

  // A guest can only take part in an activity while they are staying, so the
  // picker is bounded by their reservation. The window starts at the later of
  // check-in and today: a stay that began days ago is still current, but the
  // API refuses any slot under ten minutes away, so defaulting to the
  // check-in date handed staff a booking that could only ever be rejected.
  useEffect(() => {
    if (!stay) return;
    setDate((current) => {
      const withinWindow =
        current >= stay.bookableFrom && current <= stay.bookableTo;
      return current && withinWindow ? current : stay.bookableFrom;
    });
  }, [stay]);

  useEffect(() => {
    if (!guestSelectedId) setDate('');
  }, [guestSelectedId]);

  const priceLabel = useMemo(() => {
    if (activity.price <= 0) return 'Complimentary';
    return `${formatRs(activity.price)} / person`;
  }, [activity.price]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guestSelectedId) {
      toast.error('Please select a guest');
      return;
    }

    if (exceedsRemaining) {
      toast.error(
        remaining === 0
          ? `That session is fully booked at ${timeSlot}.`
          : `Only ${remaining} place${remaining === 1 ? '' : 's'} left at ${timeSlot}.`,
      );
      return;
    }

    setIsSaving(true);
    const response = await fetch('/api/activities/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityId: activity.id,
        guestId: guestSelectedId,
        date,
        timeSlot,
        participants,
        pickupPoint,
        notes: notes.trim() || undefined,
      }),
    });

    setIsSaving(false);
    if (response.ok) {
      toast.success('Booking confirmed');
      onBooked?.();
      onClose();
      return;
    }

    // Surface why it was refused. A flat "Unable to confirm booking" hid the
    // actual reason — a past time slot, a full session — leaving no way to
    // tell what to change.
    const error = await response.json().catch(() => null);
    toast.error(error?.error || 'Unable to confirm booking');
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Book Activity" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex gap-4 rounded-xl border border-border bg-surface-secondary/80 p-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-secondary">
            {activity.imagePath ? (
              <img src={activity.imagePath} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">{activity.name}</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {activity.durationLabel} • {activity.category}
            </p>
            <p className="mt-1 text-sm font-semibold text-primary">{priceLabel}</p>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Select Guest</span>
          <GuestSearchPicker
            selectedId={guestSelectedId}
            onSelect={setSelectedGuest}
            placeholder="Search in-house guests..."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">Date</span>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
              <input
                type="date"
                required
                value={date}
                min={stay?.bookableFrom}
                max={stay?.bookableTo}
                disabled={!guestSelectedId || !stay || !stay.hasBookableDays}
                onChange={(event) => setDate(event.target.value)}
                className="input-field pl-10 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {!guestSelectedId
                ? 'Select a guest first.'
                : isLoadingStay
                  ? 'Checking their stay dates...'
                  : !stay
                    ? 'This guest has no active reservation, so there are no dates to book.'
                    : !stay.hasBookableDays
                      ? `Their stay ended on ${formatStayDay(stay.to)}, so there are no dates left to book.`
                      : `Stay period: ${formatStayDay(stay.from)} — ${formatStayDay(stay.to)}`}
            </p>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Time Slot</span>
            <select
              value={timeSlot}
              onChange={(event) => setTimeSlot(event.target.value)}
              disabled={selectableSlots.length === 0}
              className="input-field disabled:cursor-not-allowed disabled:opacity-60"
            >
              {selectableSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
            {selectableSlots.length === 0 && (
              <p className="text-xs text-[var(--color-text-secondary)]">
                Every session for this date has already started. Pick a later date.
              </p>
            )}
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Participants</span>
            <input
              type="number"
              min={1}
              max={remaining ?? activity.capacity}
              required
              value={participants}
              onChange={(event) => setParticipants(Number(event.target.value))}
              className="input-field"
            />
            <p
              className={`text-xs ${
                exceedsRemaining || remaining === 0
                  ? 'text-[var(--color-danger)]'
                  : 'text-[var(--color-text-secondary)]'
              }`}
            >
              {!date
                ? 'Pick a date to see availability.'
                : isLoadingAvailability || remaining === undefined
                  ? 'Checking availability...'
                  : remaining === 0
                    ? `Fully booked at ${timeSlot} — no places left.`
                    : exceedsRemaining
                      ? `Only ${remaining} place${remaining === 1 ? '' : 's'} left at ${timeSlot}.`
                      : `${remaining} of ${availability?.capacity} place${remaining === 1 ? '' : 's'} left at ${timeSlot}.`}
            </p>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Pickup Point</span>
            <select
              value={pickupPoint}
              onChange={(event) => setPickupPoint(event.target.value)}
              className="input-field"
            >
              {PICKUP_POINTS.map((point) => (
                <option key={point} value={point}>
                  {point}
                </option>
              ))}
            </select>
          </label>
        </div>

          <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Special Requirements</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="input-field min-h-24"
            placeholder="Dietary needs, physical limitations..."
          />
        </label>

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Booking...' : 'Confirm Booking'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function formatDefaultTime(value: string) {
  if (/AM|PM/i.test(value)) return value;
  const [h, m] = value.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m ?? 0).padStart(2, '0')} ${period}`;
}
