'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { GuestSearchPicker } from '@/components/pickers/GuestSearchPicker';
import { RoomSearchPicker } from '@/components/pickers/RoomSearchPicker';
import { Guest, Room } from '@/types';

function daysBetween(checkIn: string, checkOut: string) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function AssignRoomPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedGuestId = searchParams.get('guestId') ?? '';

  const [guest, setGuest] = useState<Guest | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [totalAmount, setTotalAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!preselectedGuestId) return;
    fetch(`/api/guests/${preselectedGuestId}`)
      .then((response) => response.json())
      .then((result) => {
        if (result.success && result.data) setGuest(result.data as Guest);
      })
      .catch(() => undefined);
  }, [preselectedGuestId]);

  const autoTotal = room && checkIn && checkOut ? room.price * daysBetween(checkIn, checkOut) : 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guest || !room || !checkIn || !checkOut) {
      toast.error('Select a guest, dates, and an available room');
      return;
    }

    setIsSaving(true);
    const total = Number(totalAmount) > 0 ? Number(totalAmount) : autoTotal;

    const response = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestId: guest.id,
        roomId: room.id,
        checkIn,
        checkOut,
        adults,
        children,
        totalAmount: total,
        status: 'CONFIRMED',
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      toast.error(body.error ?? 'Unable to assign room');
      return;
    }

    toast.success(`Room ${room.roomNumber} assigned to ${guest.firstName} ${guest.lastName}`);
    router.push('/reservations/calendar');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Assign Room"
        subtitle="Choose a guest, stay dates, and an available room. Only free rooms for those dates are listed."
      />

      <form onSubmit={handleSubmit} className="space-y-6 rounded-[24px] border border-sand-200 bg-white p-6 shadow-sm md:p-8">
        <section>
          <h2 className="mb-4 font-display text-xl text-ink-900">Select Guest</h2>
          <GuestSearchPicker selectedId={guest?.id ?? ''} onSelect={setGuest} />
        </section>

        <section className="border-t border-sand-200 pt-6">
          <h2 className="mb-4 font-display text-xl text-ink-900">Stay Dates</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">Check-in</label>
              <input
                type="date"
                required
                className="input-field w-full"
                value={checkIn}
                onChange={(event) => {
                  setCheckIn(event.target.value);
                  setRoom(null);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">Check-out</label>
              <input
                type="date"
                required
                className="input-field w-full"
                value={checkOut}
                min={checkIn || undefined}
                onChange={(event) => {
                  setCheckOut(event.target.value);
                  setRoom(null);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">Adults</label>
              <input
                type="number"
                min={1}
                className="input-field w-full"
                value={adults}
                onChange={(event) => setAdults(Number(event.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">Children</label>
              <input
                type="number"
                min={0}
                className="input-field w-full"
                value={children}
                onChange={(event) => setChildren(Number(event.target.value))}
              />
            </div>
          </div>
        </section>

        <section className="border-t border-sand-200 pt-6">
          <h2 className="mb-2 font-display text-xl text-ink-900">Available Rooms</h2>
          <p className="mb-4 text-sm text-ink-500">
            {checkIn && checkOut
              ? 'Showing rooms free for the selected dates.'
              : 'Enter check-in and check-out dates to see available rooms.'}
          </p>
          {checkIn && checkOut ? (
            <RoomSearchPicker
              selectedId={room?.id ?? ''}
              onSelect={setRoom}
              checkIn={checkIn}
              checkOut={checkOut}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-sand-200 bg-sand-50/50 px-4 py-6 text-center text-sm text-ink-500">
              Select dates above to load available rooms.
            </p>
          )}
        </section>

        {room && checkIn && checkOut && (
          <section className="border-t border-sand-200 pt-6">
            <label className="mb-1 block text-sm font-medium text-ink-700">
              Total amount {autoTotal > 0 ? `(suggested: Rs ${autoTotal.toLocaleString()})` : ''}
            </label>
            <input
              type="number"
              min={0}
              className="input-field w-full"
              placeholder={autoTotal > 0 ? String(autoTotal) : undefined}
              value={totalAmount}
              onChange={(event) => setTotalAmount(event.target.value)}
            />
          </section>
        )}

        <div className="flex flex-wrap justify-end gap-3 border-t border-sand-200 pt-6">
          <Link href="/rooms" className="btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSaving || !guest || !room || !checkIn || !checkOut}
            className="btn-primary disabled:opacity-50"
          >
            {isSaving ? 'Assigning...' : 'Assign Room'}
          </button>
        </div>
      </form>
    </div>
  );
}
