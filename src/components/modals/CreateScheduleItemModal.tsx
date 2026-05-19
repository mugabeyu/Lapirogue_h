'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/Modal';
import { useApi } from '@/hooks/useApi';

type ScheduleItemType = 'RESERVATION' | 'ACTIVITY' | 'BOOKING' | 'ORDER' | 'SERVICE' | 'CUSTOM';

type LinkableOption = {
  id: string;
  label: string;
  subtitle?: string;
  meta?: string;
  price?: number;
  defaultTime?: string;
};

type GuestOption = {
  id: string;
  firstName: string;
  lastName: string;
  roomNumber?: string | null;
};

type CreateSlot = {
  guestId: string;
  startAt: string;
  endAt: string;
  itemType: ScheduleItemType;
  title: string;
};

type CreateScheduleItemModalProps = {
  isOpen: boolean;
  onClose: () => void;
  guests: GuestOption[];
  slot: CreateSlot | null;
  onCreated: () => void;
};

const TYPE_LABELS: Record<ScheduleItemType, string> = {
  RESERVATION: 'Reservation',
  ACTIVITY: 'Activity',
  BOOKING: 'Tour / excursion',
  ORDER: 'Food & beverage order',
  SERVICE: 'Service',
  CUSTOM: 'Custom',
};

function usesLinkedPicker(type: ScheduleItemType) {
  return type === 'ACTIVITY' || type === 'BOOKING' || type === 'ORDER';
}

function pickerLabel(type: ScheduleItemType) {
  if (type === 'ORDER') return 'Menu item';
  if (type === 'BOOKING') return 'Tour or excursion';
  return 'Activity';
}

function calendarDateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function toTimeInput(date: Date) {
  return date.toTimeString().slice(0, 5);
}

function formatRs(price: number) {
  return `Rs ${price.toLocaleString('en-IN')}`;
}

export function CreateScheduleItemModal({
  isOpen,
  onClose,
  guests,
  slot,
  onCreated,
}: CreateScheduleItemModalProps) {
  const [guestId, setGuestId] = useState('');
  const [itemType, setItemType] = useState<ScheduleItemType>('CUSTOM');
  const [sourceId, setSourceId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [participants, setParticipants] = useState(2);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const optionsUrl = usesLinkedPicker(itemType) ? `/api/schedule/options?type=${itemType}` : null;
  const { data: options, isLoading: optionsLoading } = useApi<LinkableOption[]>(optionsUrl ?? '');

  const linkedOptions = options ?? [];
  const selectedOption = useMemo(
    () => linkedOptions.find((option) => option.id === sourceId) ?? null,
    [linkedOptions, sourceId],
  );

  const showLinkedPicker = usesLinkedPicker(itemType);
  const showTitleField = !showLinkedPicker;
  const showParticipants = itemType === 'ACTIVITY' || itemType === 'BOOKING';

  useEffect(() => {
    if (!isOpen || !slot) return;
    setGuestId(slot.guestId);
    setItemType(slot.itemType);
    setTitle(slot.title);
    setDate(calendarDateKey(slot.startAt));
    setStartTime(toTimeInput(new Date(slot.startAt)));
    setEndTime(toTimeInput(new Date(slot.endAt)));
    setSourceId('');
    setNotes('');
    setParticipants(2);
  }, [isOpen, slot]);

  useEffect(() => {
    setSourceId('');
    if (itemType === 'ACTIVITY' || itemType === 'BOOKING') {
      setTitle('');
    }
  }, [itemType]);

  useEffect(() => {
    if (!selectedOption?.defaultTime) return;
    const normalized = selectedOption.defaultTime.length === 5
      ? selectedOption.defaultTime
      : selectedOption.defaultTime.slice(0, 5);
    if (/^\d{2}:\d{2}$/.test(normalized)) {
      setStartTime(normalized);
      const [h, m] = normalized.split(':').map(Number);
      const end = new Date();
      end.setHours(h + 1, m, 0, 0);
      setEndTime(toTimeInput(end));
    }
  }, [selectedOption?.id, selectedOption?.defaultTime]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guestId) {
      toast.error('Select a guest');
      return;
    }
    if (showLinkedPicker && !sourceId) {
      toast.error(`Select a ${pickerLabel(itemType).toLowerCase()}`);
      return;
    }
    if (showTitleField && !title.trim()) {
      toast.error('Enter a title');
      return;
    }

    setIsSaving(true);

    const startAt = `${date}T${startTime}:00`;
    const endAt = `${date}T${endTime}:00`;

    const response = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestId,
        itemType,
        sourceId: showLinkedPicker ? sourceId : undefined,
        title: showTitleField ? title.trim() : selectedOption?.label,
        startAt,
        endAt,
        participants: showParticipants ? participants : undefined,
        notes: notes.trim() || undefined,
      }),
    });

    const payload = await response.json();
    setIsSaving(false);

    if (!response.ok) {
      toast.error(payload.error ?? 'Unable to save schedule item');
      return;
    }

    toast.success(
      itemType === 'ORDER'
        ? 'Order added and linked to Food & Beverage'
        : itemType === 'ACTIVITY' || itemType === 'BOOKING'
          ? 'Booking added to Activities & Tours'
          : 'Schedule item saved',
    );
    onCreated();
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create schedule item"
      subtitle="Link an existing activity, tour, or order — or add a custom entry for this guest."
      size="lg"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-700">Guest</span>
            <select
              value={guestId}
              onChange={(event) => setGuestId(event.target.value)}
              className="input-field w-full"
              required
            >
              <option value="">Select guest</option>
              {guests.map((guest) => (
                <option key={guest.id} value={guest.id}>
                  {guest.firstName} {guest.lastName}
                  {guest.roomNumber ? ` · Room ${guest.roomNumber}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-700">Type</span>
            <select
              value={itemType}
              onChange={(event) => setItemType(event.target.value as ScheduleItemType)}
              className="input-field w-full"
              required
            >
              {(Object.keys(TYPE_LABELS) as ScheduleItemType[]).map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {showLinkedPicker && (
          <div className="rounded-xl border border-sand-200 bg-sand-50/60 p-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink-700">{pickerLabel(itemType)}</span>
              <select
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
                className="input-field w-full bg-white"
                required
                disabled={optionsLoading}
              >
                <option value="">
                  {optionsLoading ? 'Loading options...' : `Select ${pickerLabel(itemType).toLowerCase()}`}
                </option>
                {linkedOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                    {option.subtitle ? ` · ${option.subtitle}` : ''}
                  </option>
                ))}
              </select>
            </label>

            {selectedOption && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600">
                {selectedOption.subtitle && <span>{selectedOption.subtitle}</span>}
                {selectedOption.meta && <span>{selectedOption.meta}</span>}
                {selectedOption.price !== undefined && (
                  <span className="font-medium text-primary">{formatRs(selectedOption.price)}</span>
                )}
              </div>
            )}

            {!optionsLoading && linkedOptions.length === 0 && (
              <p className="mt-2 text-sm text-ink-500">
                No {pickerLabel(itemType).toLowerCase()}s available. Add items in Activities or Food & Beverage first.
              </p>
            )}
          </div>
        )}

        {showTitleField && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-700">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="input-field w-full"
              placeholder="Spa treatment, room transfer, concierge request..."
              required
            />
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-700">Date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="input-field w-full"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-700">Start time</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="input-field w-full"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-700">End time</span>
            <input
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              className="input-field w-full"
              required
            />
          </label>
        </div>

        {showParticipants && (
          <label className="block max-w-xs space-y-1.5">
            <span className="text-sm font-medium text-ink-700">Participants</span>
            <input
              type="number"
              min={1}
              max={99}
              value={participants}
              onChange={(event) => setParticipants(Number(event.target.value))}
              className="input-field w-full"
              required
            />
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink-700">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="input-field w-full resize-none"
            placeholder="Optional notes for this schedule entry"
          />
        </label>

        <div className="flex justify-end gap-3 border-t border-sand-200 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary inline-flex items-center gap-2 disabled:opacity-50" disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save item'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
