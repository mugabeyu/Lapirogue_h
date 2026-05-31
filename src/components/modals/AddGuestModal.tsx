'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { toast } from 'sonner';
import { CountryComboboxField } from '@/components/ui/CountryComboboxField';
import { PhoneField } from '@/components/ui/PhoneField';

interface AddGuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
  redirectToAssign?: boolean;
}

export function AddGuestModal({ isOpen, onClose, onSaved, redirectToAssign = true }: AddGuestModalProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

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

    setIsSaving(false);

    if (!guestResponse.ok) {
      toast.error('Unable to register guest');
      return;
    }

    const created = await guestResponse.json();
    const guestId = created?.data?.id as string | undefined;

    toast.success('Guest registered. Assign a room to complete the stay.');
    if (onSaved) await onSaved();
    onClose();

    if (redirectToAssign && guestId) {
      router.push(`/rooms/assign?guestId=${guestId}`);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Register Guest" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Register guest details first. You will assign an available room on the next step.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">First Name</label>
            <input name="firstName" required className="input-field w-full" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Last Name</label>
            <input name="lastName" required className="input-field w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Email</label>
            <input name="email" type="email" className="input-field w-full" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Phone</label>
            <PhoneField name="phone" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Nationality</label>
            <CountryComboboxField name="nationality" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Passport</label>
            <input name="passport" className="input-field w-full" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Date of Birth</label>
          <input name="dateOfBirth" type="date" className="input-field w-full" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Notes</label>
          <textarea name="notes" className="input-field w-full" rows={3} />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <input type="checkbox" name="vip" className="rounded border-border" />
          VIP guest
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Register Guest'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
