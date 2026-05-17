'use client';

import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { useApi } from '@/hooks/useApi';
import { Guest, Room } from '@/types';

export default function AddReservationPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const { data: guests } = useApi<Guest[]>('/api/guests?limit=100');
  const { data: rooms } = useApi<Room[]>(`/api/rooms${checkIn && checkOut ? `?checkIn=${checkIn}&checkOut=${checkOut}` : ''}`);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);

    const response = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestId: formData.get('guestId'),
        roomId: formData.get('roomId'),
        checkIn: formData.get('checkIn'),
        checkOut: formData.get('checkOut'),
        adults: Number(formData.get('adults')),
        children: Number(formData.get('children')),
        totalAmount: Number(formData.get('totalAmount')),
      }),
    });

    setIsSaving(false);
    toast[response.ok ? 'success' : 'error'](
      response.ok ? 'Reservation saved' : 'Unable to save reservation',
    );
  }

  return (
    <div className="max-w-3xl space-y-6 animate-in fade-in duration-500">
      <PageHeader title="New Reservation" />
      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <select name="guestId" required className="input-field">
          <option value="">Select guest</option>
          {(guests ?? []).map((guest) => (
            <option key={guest.id} value={guest.id}>
              {guest.firstName} {guest.lastName}
            </option>
          ))}
        </select>
        <select name="roomId" required className="input-field">
          <option value="">Select room</option>
          {(rooms ?? []).map((room) => (
            <option key={room.id} value={room.id}>
              Room {room.roomNumber} ({room.type})
            </option>
          ))}
        </select>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="checkIn"
            required
            type="date"
            className="input-field"
            onChange={(e) => setCheckIn(e.target.value)}
          />
          <input
            name="checkOut"
            required
            type="date"
            className="input-field"
            onChange={(e) => setCheckOut(e.target.value)}
          />
          <input name="adults" required type="number" min="1" className="input-field" placeholder="Adults" />
          <input name="children" required type="number" min="0" className="input-field" placeholder="Children" />
          <input name="totalAmount" required type="number" min="0" className="input-field md:col-span-2" placeholder="Total amount" />
        </div>
        <button disabled={isSaving} className="btn-primary disabled:opacity-50">
          {isSaving ? 'Saving...' : 'Save Reservation'}
        </button>
      </form>
    </div>
  );
}
