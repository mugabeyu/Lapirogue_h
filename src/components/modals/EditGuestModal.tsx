'use client';

import { FormEvent, useState } from 'react';
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

export function EditGuestModal({ isOpen, onClose, guest, currentStay, onSaved }: EditGuestModalProps) {
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

    const checkOut = String(formData.get('checkOut') ?? '');
    let reservationOk = true;

    if (currentStay && checkOut && checkOut !== currentStay.checkOut && currentStay.roomId) {
      const reservationResponse = await fetch('/api/reservations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentStay.id,
          guestId: guest.id,
          roomId: currentStay.roomId,
          checkIn: currentStay.checkIn,
          checkOut,
          adults: currentStay.adults,
          children: currentStay.children,
          totalAmount: currentStay.totalAmount,
          status: currentStay.status,
        }),
      });
      reservationOk = reservationResponse.ok;
    }

    setIsSaving(false);

    if (!guestResponse.ok) {
      const errorData = await guestResponse.json().catch(() => ({}));
      toast.error(errorData.error || errorData.details || 'Unable to update guest');
      return;
    }

    if (!reservationOk) {
      toast.error('Guest updated, but check-out date could not be saved');
      return;
    }

    toast.success('Guest profile updated');
    if (onSaved) await onSaved();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile" size="lg">
<form key={guest.id} onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-secondary/30 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            Guest profile photo uploads are disabled for admin users.
          </div>
          <FormField label="First Name" name="firstName" defaultValue={guest.firstName} required>
            <input name="firstName" required className="input-field w-full" defaultValue={guest.firstName} />
          </FormField>
          <FormField label="Last Name" name="lastName" defaultValue={guest.lastName} required>
            <input name="lastName" required className="input-field w-full" defaultValue={guest.lastName} />
          </FormField>
          <FormField label="Email" type="email" name="email" defaultValue={guest.email ?? ''} required>
            <input name="email" type="email" required className="input-field w-full" defaultValue={guest.email ?? ''} />
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
            <p className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">Current Stay</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Check-in</label>
                <input type="date" className="input-field w-full bg-surface-secondary" value={currentStay.checkIn} readOnly />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Check-out</label>
                <input
                  name="checkOut"
                  type="date"
                  className="input-field w-full"
                  defaultValue={currentStay.checkOut}
                  min={currentStay.checkIn}
                  required
                />
              </div>
            </div>
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
