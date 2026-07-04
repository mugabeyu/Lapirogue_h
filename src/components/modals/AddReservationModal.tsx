'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  const [roomPrice, setRoomPrice] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const isEdit = Boolean(editRow?.id);

  const roomsUrl = useMemo(() => {
    if (isEdit) return null;
    if (checkIn && checkOut) return `/api/rooms?checkIn=${checkIn}&checkOut=${checkOut}`;
    return null;
  }, [checkIn, checkOut, isEdit]);

  const { data: guests } = useApi<Guest[]>('/api/guests?limit=100');
  const { data: rooms } = useApi<Room[]>(roomsUrl);

  // Fetch the assigned room's price per night when editing
  useEffect(() => {
    if (!isOpen || !isEdit || !editRow?.roomId) return;
    setRoomPrice(0);
    fetch(`/api/rooms?limit=500`)
      .then((res) => res.json())
      .then((result) => {
        const found = (result?.data ?? []).find(
          (r: { id: string; price: number }) => r.id === editRow.roomId,
        );
        if (found) setRoomPrice(found.price);
      })
      .catch(() => {});
  }, [isOpen, isEdit, editRow?.roomId]);

  // Auto-calculate total amount when dates change (edit mode only)
  const autoTotal = useMemo(() => {
    if (!isEdit || !checkIn || !checkOut || !roomPrice) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nights = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return nights * roomPrice;
  }, [checkIn, checkOut, roomPrice, isEdit]);

  useEffect(() => {
    if (!isOpen) return;
    setCheckIn(String(editRow?.checkIn ?? ''));
    setCheckOut(String(editRow?.checkOut ?? ''));
    setTotalAmount(Number(editRow?.totalAmount ?? 0));
  }, [isOpen, editRow]);

  // Update total when dates change in edit mode
  useEffect(() => {
    if (isEdit && autoTotal > 0) {
      setTotalAmount(autoTotal);
    }
  }, [autoTotal, isEdit]);

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
      totalAmount: isEdit ? totalAmount : Number(formData.get('totalAmount')),
    };

    const response = await fetch('/api/reservations', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setIsSaving(false);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      toast.error(errorData.error || errorData.details || 'Unable to save reservation');
      return;
    }

    toast.success(isEdit ? 'Reservation updated' : 'Reservation saved');
    if (onSaved) await onSaved();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Reservation' : 'Add Reservation'} size="lg">
      <form key={String(editRow?.id ?? 'new')} onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Guest</label>
          {isEdit ? (
            <div className="input-field w-full flex items-center gap-2 text-[var(--color-text-primary)]">
              {editRow?.guestImagePath ? (
                <img src={String(editRow.guestImagePath)} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : null}
              <span>{String(editRow?.guest ?? '')}</span>
              <input type="hidden" name="guestId" value={String(editRow?.guestId ?? '')} />
            </div>
          ) : (
            <select name="guestId" required className="input-field w-full" defaultValue={String(editRow?.guestId ?? '')}>
              <option value="">Select guest</option>
              {(guests ?? []).map((guest) => (
                <option key={guest.id} value={guest.id}>
                  {guest.firstName} {guest.lastName}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Room</label>
          {isEdit ? (
            <div className="input-field w-full flex items-center gap-2 text-[var(--color-text-primary)]">
              <span>Room {String(editRow?.room ?? '')} ({String(editRow?.roomType ?? '')})</span>
              <input type="hidden" name="roomId" value={String(editRow?.roomId ?? '')} />
            </div>
          ) : (
            <select name="roomId" required className="input-field w-full" defaultValue={String(editRow?.roomId ?? '')}>
              <option value="">Select room</option>
              {(rooms ?? []).map((room) => (
                <option key={room.id} value={room.id}>
                  Room {room.roomNumber} ({room.type})
                </option>
              ))}
            </select>
          )}
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
            {isEdit ? (
              <>
                <input
                  name="totalAmount"
                  required
                  type="number"
                  min="0"
                  className="input-field w-full"
                  value={totalAmount}
                  readOnly
                />
                {roomPrice > 0 && (
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Auto-calculated: {Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)))} nights × Rs {roomPrice.toLocaleString()}/night
                  </p>
                )}
              </>
            ) : (
              <input
                name="totalAmount"
                required
                type="number"
                min="0"
                className="input-field w-full"
                defaultValue={Number(editRow?.totalAmount ?? 0)}
              />
            )}
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
