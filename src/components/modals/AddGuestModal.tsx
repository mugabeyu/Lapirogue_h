'use client';

import { FormEvent, useState } from 'react';
import { Modal } from '@/components/Modal';
import { toast } from 'sonner';
import { useApi } from '@/hooks/useApi';
import { Room } from '@/types';

interface AddGuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
}

function daysBetween(checkIn: string, checkOut: string) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function AddGuestModal({ isOpen, onClose, onSaved }: AddGuestModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const { data: rooms } = useApi<Room[]>(`/api/rooms${checkIn && checkOut ? `?checkIn=${checkIn}&checkOut=${checkOut}` : ''}`);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const guestResponse = await fetch('/api/guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        nationality: formData.get('nationality'),
        passport: formData.get('passport'),
        dateOfBirth: formData.get('dateOfBirth'),
        vip: formData.get('vip') === 'on',
        notes: formData.get('notes'),
      }),
    });

    let reservationResponse: Response | null = null;
    if (guestResponse.ok && formData.get('checkIn') && formData.get('checkOut') && formData.get('roomId')) {
      const createdGuest = await guestResponse.clone().json();
      const roomId = String(formData.get('roomId'));
      const room = (rooms ?? []).find((item) => item.id === roomId);
      const checkInDate = String(formData.get('checkIn'));
      const checkOutDate = String(formData.get('checkOut'));
      const enteredTotal = Number(formData.get('totalAmount') || 0);
      const autoTotal = room ? room.price * daysBetween(checkInDate, checkOutDate) : 0;

      reservationResponse = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: createdGuest?.data?.id,
          roomId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          adults: Number(formData.get('adults') || 1),
          children: Number(formData.get('children') || 0),
          totalAmount: enteredTotal > 0 ? enteredTotal : autoTotal,
        }),
      });
    }

    setIsSaving(false);

    if (!guestResponse.ok) {
      toast.error('Unable to add guest');
      return;
    }

    if (reservationResponse && !reservationResponse.ok) {
      toast.error('Guest added, but reservation could not be created');
      return;
    }

    toast.success('Guest added');
    if (onSaved) {
      await onSaved();
    }
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Register Guest" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">First Name</label>
            <input name="firstName" required className="input-field w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Last Name</label>
            <input name="lastName" required className="input-field w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input name="email" type="email" className="input-field w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input name="phone" className="input-field w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nationality</label>
            <input name="nationality" className="input-field w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Passport</label>
            <input name="passport" className="input-field w-full" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date of Birth</label>
          <input name="dateOfBirth" type="date" className="input-field w-full" />
        </div>
        <div className="border-t border-sand-200 pt-4">
          <div className="mb-3 text-sm font-medium text-ink-900">Stay Details</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Check-in Date</label>
              <input
                name="checkIn"
                type="date"
                required
                className="input-field w-full"
                onChange={(event) => setCheckIn(event.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Check-out Date</label>
              <input
                name="checkOut"
                type="date"
                required
                className="input-field w-full"
                onChange={(event) => setCheckOut(event.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Room</label>
              <select name="roomId" className="input-field w-full">
                <option value="">Select room for stay</option>
                {(rooms ?? []).map((room) => (
                  <option key={room.id} value={room.id}>
                    Room {room.roomNumber} ({room.type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Adults</label>
              <input name="adults" type="number" min="1" defaultValue="1" className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Children</label>
              <input name="children" type="number" min="0" defaultValue="0" className="input-field w-full" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Total Amount (optional)</label>
              <input name="totalAmount" type="number" min="0" className="input-field w-full" placeholder="Auto-calculated if left empty" />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea name="notes" className="input-field w-full" rows={3} />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Register Guest'}
          </button>
        </div>
      </form>
    </Modal>
  );
}