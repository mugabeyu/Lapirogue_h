'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { CountryComboboxField } from '@/components/ui/CountryComboboxField';
import { ImageUploadField } from '@/components/ui/ImageUploadField';
import { PhoneField } from '@/components/ui/PhoneField';
import { uploadImage } from '@/lib/upload-image';
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
  const [imagePath, setImagePath] = useState<string | null>(guest.imagePath ?? null);

  useEffect(() => {
    if (!isOpen) return;
    setImagePath(guest.imagePath ?? null);
  }, [isOpen, guest.id, guest.imagePath]);

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
      toast.error('Unable to update guest');
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

  async function handlePhotoUpload(file: File) {
    const url = await uploadImage({ file, bucket: 'guest-photos', id: guest.id, target: 'guest' });
    if (!url) throw new Error('Upload failed');
    setImagePath(url);
    await fetch(`/api/guests/${guest.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath: url }),
    });
    toast.success('Guest photo updated');
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile" size="lg">
      <form key={guest.id} onSubmit={handleSubmit} className="space-y-4">
        <ImageUploadField label="Guest photo" shape="circle" previewUrl={imagePath} onFileSelect={handlePhotoUpload} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name" name="firstName" defaultValue={guest.firstName} required />
          <Field label="Last Name" name="lastName" defaultValue={guest.lastName} required />
          <Field label="Email" name="email" type="email" defaultValue={guest.email ?? ''} />
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Phone</label>
            <PhoneField name="phone" defaultValue={guest.phone ?? ''} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Nationality</label>
            <CountryComboboxField name="nationality" defaultValue={guest.nationality ?? ''} />
          </div>
          <Field label="Passport" name="passport" defaultValue={guest.passport ?? ''} />
          <Field label="Date of Birth" name="dateOfBirth" type="date" defaultValue={guest.dateOfBirth ?? ''} />
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Status</label>
            <select name="status" defaultValue={guest.status} className="input-field w-full">
              <option value="RESERVED">Reserved</option>
              <option value="CHECKED_IN">Checked In</option>
              <option value="CHECKED_OUT">Checked Out</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

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

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="input-field w-full"
      />
    </div>
  );
}
