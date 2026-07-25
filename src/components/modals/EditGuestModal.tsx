'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FormField } from '@/components/ui/FormSection';
import { Modal } from '@/components/Modal';
import { CountryComboboxField } from '@/components/ui/CountryComboboxField';
import { PhoneField } from '@/components/ui/PhoneField';
import { toast } from 'sonner';
import { Guest, GuestStay } from '@/types';

interface EditGuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  guest: Guest;
  currentStay?: GuestStay | null;
  onSaved?: () => void | Promise<void>;
}

/** Adds `days` to a `YYYY-MM-DD` key without going through local-timezone Date parsing. */
function addDays(dayKey: string, days: number) {
  if (!dayKey) return '';
  const [year, month, day] = dayKey.split('-').map(Number);
  if (!year || !month || !day) return '';
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function countNights(from: string, to: string) {
  if (!from || !to || to <= from) return 0;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

export function EditGuestModal({ isOpen, onClose, guest, currentStay, onSaved }: EditGuestModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [checkIn, setCheckIn] = useState(currentStay?.checkIn ?? '');
  const [checkOut, setCheckOut] = useState(currentStay?.checkOut ?? '');

  // The parent keeps this mounted across guests, so the date fields have to
  // follow whichever stay is being edited rather than keeping the first one.
  useEffect(() => {
    setCheckIn(currentStay?.checkIn ?? '');
    setCheckOut(currentStay?.checkOut ?? '');
  }, [currentStay?.id, currentStay?.checkIn, currentStay?.checkOut]);

  const minCheckOut = checkIn ? addDays(checkIn, 1) : undefined;
  const nights = countNights(checkIn, checkOut);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (currentStay && checkOut <= checkIn) {
      toast.error('Check-out must be at least one day after check-in');
      return;
    }

    setIsSaving(true);
    const formData = new FormData(event.currentTarget);

    const guestResponse = await fetch(`/api/guests/${guest.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email') || undefined,
        phone: formData.get('phone') || undefined,
        nationality: formData.get('nationality') || undefined,
        passport: formData.get('passport') || undefined,
        dateOfBirth: formData.get('dateOfBirth') || undefined,
        status: formData.get('status'),
        notes: formData.get('notes') || undefined,
        vip: formData.get('vip') === 'on',
      }),
    });

    const stayChanged =
      Boolean(currentStay) &&
      (checkIn !== currentStay?.checkIn || checkOut !== currentStay?.checkOut);

    let stayError: string | null = null;

    if (currentStay && stayChanged) {
      // Only the dates are sent — the API keeps every field this form does not
      // render (room, occupancy, amount) at its stored value.
      const reservationResponse = await fetch('/api/reservations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentStay.id,
          checkIn,
          checkOut,
        }),
      });

      if (!reservationResponse.ok) {
        const errorData = await reservationResponse.json().catch(() => ({}));
        stayError = errorData.error || 'The stay period could not be saved';
      }
    }

    setIsSaving(false);

    if (!guestResponse.ok) {
      const errorData = await guestResponse.json().catch(() => ({}));
      toast.error(errorData.error || errorData.details || 'Unable to update guest');
      return;
    }

    if (stayError) {
      toast.error(stayError);
      return;
    }

    toast.success('Guest profile updated');
    if (onSaved) await onSaved();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile" size="lg">
      <form key={guest.id} onSubmit={handleSubmit} className="space-y-4">
          <FormField label="First Name" name="firstName" defaultValue={guest.firstName} required>
            <input name="firstName" required className="input-field w-full" defaultValue={guest.firstName} />
          </FormField>
          <FormField label="Last Name" name="lastName" defaultValue={guest.lastName} required>
            <input name="lastName" required className="input-field w-full" defaultValue={guest.lastName} />
          </FormField>
          <FormField label="Email" type="email" name="email" defaultValue={guest.email ?? ''}>
            <input name="email" type="email" className="input-field w-full" defaultValue={guest.email ?? ''} readOnly tabIndex={-1} />
          </FormField>
          <FormField label="Phone" name="phone">
            <PhoneField name="phone" defaultValue={guest.phone ?? ''} />
          </FormField>
          <FormField label="Nationality" name="nationality">
            <CountryComboboxField name="nationality" defaultValue={guest.nationality ?? ''} />
          </FormField>
          <FormField label="Passport" name="passport" defaultValue={guest.passport ?? ''} required>
            <input name="passport" required className="input-field w-full" defaultValue={guest.passport ?? ''} />
          </FormField>
          <FormField label="Date of Birth" type="date" name="dateOfBirth" defaultValue={guest.dateOfBirth ?? ''} required>
            <input name="dateOfBirth" type="date" required className="input-field w-full" defaultValue={guest.dateOfBirth ?? ''} />
          </FormField>
          <FormField label="Status" name="status">
            <select name="status" defaultValue={guest.status} className="input-field w-full">
              <option value="RESERVED">Reserved</option>
              <option value="CHECKED_IN">Checked In</option>
              <option value="CHECKED_OUT">Checked Out</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </FormField>

        {currentStay && (
          <div className="rounded-xl border border-border bg-surface-secondary/50 p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Current Stay</p>
              {nights > 0 && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {nights} {nights === 1 ? 'night' : 'nights'}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="checkIn" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Check-in</label>
                <input
                  id="checkIn"
                  name="checkIn"
                  type="date"
                  className="input-field w-full"
                  value={checkIn}
                  onChange={(event) => setCheckIn(event.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="checkOut" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Check-out</label>
                <input
                  id="checkOut"
                  name="checkOut"
                  type="date"
                  className="input-field w-full"
                  value={checkOut}
                  onChange={(event) => setCheckOut(event.target.value)}
                  min={minCheckOut}
                  required
                />
              </div>
            </div>
            {checkOut && checkIn && checkOut <= checkIn && (
              <p className="mt-2 text-sm text-[var(--color-danger)]">
                Check-out must be at least one day after check-in.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Notes</label>
          <textarea name="notes" className="input-field w-full" rows={3} defaultValue={guest.notes ?? ''} />
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <input type="checkbox" name="vip" defaultChecked={guest.vip} className="rounded border-border" />
          VIP guest
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
