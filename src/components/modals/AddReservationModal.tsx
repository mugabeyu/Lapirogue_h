'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { useApi } from '@/hooks/useApi';
import { Guest, Room } from '@/types';
import { toast } from 'sonner';

interface AddReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
  editRow?: Record<string, unknown> | null;
}

export function AddReservationModal({ isOpen, onClose, onSaved, editRow }: AddReservationModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const isEdit = Boolean(editRow?.id);

  const { data: guests } = useApi<Guest[]>('/api/guests?limit=100');
  const { data: rooms } = useApi<Room[]>(`/api/rooms${checkIn && checkOut ? `?checkIn=${checkIn}&checkOut=${checkOut}` : ''}`);

  useEffect(() => {
    if (!isOpen) return;
    setCheckIn(String(editRow?.checkIn ?? ''));
    setCheckOut(String(editRow?.checkOut ?? ''));
  }, [isOpen, editRow]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);

    const payload = {
      id: editRow?.id,
      guestId: formData.get('guestId'),
      roomId: formData.get('roomId'),
      checkIn: formData.get('checkIn'),
      checkOut: formData.get('checkOut'),
      adults: Number(formData.get('adults')),
      children: Number(formData.get('children')),
      totalAmount: Number(formData.get('totalAmount')),
    };

    const response = await fetch('/api/reservations', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setIsSaving(false);
    toast[response.ok ? 'success' : 'error'](
      response.ok ? (isEdit ? 'Reservation updated' : 'Reservation saved') : 'Unable to save reservation',
    );

    if (response.ok) {
      if (onSaved) await onSaved();
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Reservation' : 'Add Reservation'} size="lg">
      <form key={String(editRow?.id ?? 'new')} onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Guest</label>
          <select name="guestId" required className="input-field w-full" defaultValue={String(editRow?.guestId ?? '')}>
            <option value="">Select guest</option>
            {(guests ?? []).map((guest) => (
              <option key={guest.id} value={guest.id}>
                {guest.firstName} {guest.lastName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Room</label>
          <select name="roomId" required className="input-field w-full" defaultValue={String(editRow?.roomId ?? '')}>
            <option value="">Select room</option>
            {(rooms ?? []).map((room) => (
              <option key={room.id} value={room.id}>
                Room {room.roomNumber} ({room.type})
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Check-in</label>
            <input
              name="checkIn"
              required
              type="date"
              className="input-field w-full"
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Check-out</label>
            <input
              name="checkOut"
              required
              type="date"
              className="input-field w-full"
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Adults</label>
            <input name="adults" required type="number" min="1" className="input-field w-full" defaultValue={Number(editRow?.adults ?? 1)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Children</label>
            <input name="children" required type="number" min="0" className="input-field w-full" defaultValue={Number(editRow?.children ?? 0)} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Total amount</label>
            <input
              name="totalAmount"
              required
              type="number"
              min="0"
              className="input-field w-full"
              defaultValue={Number(editRow?.totalAmount ?? 0)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Saving...' : isEdit ? 'Update Reservation' : 'Save Reservation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
