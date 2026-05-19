'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { GuestSearchPicker } from '@/components/pickers/GuestSearchPicker';
import { RoomSearchPicker } from '@/components/pickers/RoomSearchPicker';
import { AddGuestModal } from '@/components/modals/AddGuestModal';
import { Guest, Room } from '@/types';

const STEPS = ['Guest Details', 'Select Room', 'Dates & Options', 'Confirm'] as const;

function daysBetween(checkIn: string, checkOut: string) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AddReservationPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);

  const [guest, setGuest] = useState<Guest | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [totalAmount, setTotalAmount] = useState('');

  const autoTotal = room && checkIn && checkOut ? room.price * daysBetween(checkIn, checkOut) : 0;

  function canGoNext() {
    if (step === 0) return Boolean(guest);
    if (step === 1) return Boolean(room);
    if (step === 2) return Boolean(checkIn && checkOut && checkOut > checkIn);
    return true;
  }

  async function handleConfirm() {
    if (!guest || !room || !checkIn || !checkOut) return;

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
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      toast.error(body.error ?? 'Unable to save reservation');
      return;
    }

    toast.success('Reservation created');
    router.push('/reservations');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-in fade-in duration-500">
      <Link
        href="/reservations"
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Reservations
      </Link>

      <h1 className="font-display text-3xl text-ink-900">New Reservation</h1>

      <ReservationStepper currentStep={step} />

      <div className="rounded-[24px] border border-sand-200 bg-white p-6 shadow-sm md:p-8">
        {step === 0 && (
          <>
            <h2 className="mb-5 font-display text-xl text-ink-900">Select Guest</h2>
            <GuestSearchPicker
              selectedId={guest?.id ?? ''}
              onSelect={setGuest}
              footer={
                <span>
                  Can&apos;t find the guest?{' '}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => setIsGuestModalOpen(true)}
                  >
                    Register new guest
                  </button>
                </span>
              }
            />
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="mb-5 font-display text-xl text-ink-900">Select Room</h2>
            <RoomSearchPicker
              selectedId={room?.id ?? ''}
              onSelect={setRoom}
              checkIn={checkIn || undefined}
              checkOut={checkOut || undefined}
            />
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="mb-5 font-display text-xl text-ink-900">Dates &amp; Options</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink-700">Check-in</label>
                  <input
                    type="date"
                    className="input-field w-full"
                    value={checkIn}
                    onChange={(event) => setCheckIn(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink-700">Check-out</label>
                  <input
                    type="date"
                    className="input-field w-full"
                    value={checkOut}
                    min={checkIn || undefined}
                    onChange={(event) => setCheckOut(event.target.value)}
                    required
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
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-700">
                  Total amount {autoTotal > 0 ? `(suggested: Rs ${autoTotal.toLocaleString()})` : ''}
                </label>
                <input
                  type="number"
                  min={0}
                  className="input-field w-full"
                  placeholder={autoTotal > 0 ? String(autoTotal) : 'Enter total'}
                  value={totalAmount}
                  onChange={(event) => setTotalAmount(event.target.value)}
                />
              </div>
              {checkIn && checkOut && room && (
                <p className="text-sm text-ink-500">
                  Room {room.roomNumber} · {daysBetween(checkIn, checkOut)} night(s)
                </p>
              )}
            </div>
          </>
        )}

        {step === 3 && guest && room && (
          <>
            <h2 className="mb-5 font-display text-xl text-ink-900">Confirm Reservation</h2>
            <dl className="space-y-3 text-sm">
              <SummaryRow label="Guest" value={`${guest.firstName} ${guest.lastName}`} />
              <SummaryRow label="Room" value={`${room.roomNumber} (${room.type.replace('_', ' ')})`} />
              <SummaryRow label="Stay" value={`${formatDate(checkIn)} — ${formatDate(checkOut)}`} />
              <SummaryRow label="Guests" value={`${adults} adult(s), ${children} child(ren)`} />
              <SummaryRow
                label="Total"
                value={`Rs ${(Number(totalAmount) > 0 ? Number(totalAmount) : autoTotal).toLocaleString()}`}
              />
            </dl>
          </>
        )}
      </div>

      <div className="flex justify-between gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={step === 0}
          onClick={() => setStep((value) => Math.max(0, value - 1))}
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="btn-primary"
            disabled={!canGoNext()}
            onClick={() => setStep((value) => value + 1)}
          >
            Next Step
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary disabled:opacity-50"
            disabled={isSaving || !canGoNext()}
            onClick={handleConfirm}
          >
            {isSaving ? 'Saving...' : 'Confirm Reservation'}
          </button>
        )}
      </div>

      <AddGuestModal
        isOpen={isGuestModalOpen}
        onClose={() => setIsGuestModalOpen(false)}
        onSaved={() => setIsGuestModalOpen(false)}
      />
    </div>
  );
}

function ReservationStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between">
      {STEPS.map((label, index) => {
        const active = index === currentStep;
        const done = index < currentStep;
        return (
          <div key={label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {index > 0 && (
                <div className={`h-px flex-1 ${done || active ? 'bg-primary' : 'bg-sand-200'}`} />
              )}
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                  active || done ? 'bg-primary text-white' : 'bg-sand-100 text-ink-400'
                }`}
              >
                {index + 1}
              </div>
              {index < STEPS.length - 1 && (
                <div className={`h-px flex-1 ${done ? 'bg-primary' : 'bg-sand-200'}`} />
              )}
            </div>
            <span
              className={`mt-2 hidden text-center text-xs sm:block ${
                active ? 'font-medium text-ink-900' : 'text-ink-500'
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-sand-100 pb-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-medium text-ink-900">{value}</dd>
    </div>
  );
}
