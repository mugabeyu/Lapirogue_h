'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { GuestSearchPicker } from '@/components/pickers/GuestSearchPicker';
import { ActivityListItem, PICKUP_POINTS, TIME_SLOTS, formatRs } from '@/lib/activities';
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
    toast.error('Unable to confirm booking');
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
                onChange={(event) => setDate(event.target.value)}
                className="input-field pl-10"
              />
            </div>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Time Slot</span>
            <select
              value={timeSlot}
              onChange={(event) => setTimeSlot(event.target.value)}
              className="input-field"
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Participants</span>
            <input
              type="number"
              min={1}
              max={activity.capacity}
              required
              value={participants}
              onChange={(event) => setParticipants(Number(event.target.value))}
              className="input-field"
            />
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
