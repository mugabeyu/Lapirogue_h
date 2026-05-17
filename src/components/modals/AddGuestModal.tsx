'use client';

import { FormEvent, useState } from 'react';
import { Modal } from '@/components/Modal';
import { toast } from 'sonner';

interface AddGuestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddGuestModal({ isOpen, onClose }: AddGuestModalProps) {
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch('/api/guests', {
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
    toast[response.ok ? 'success' : 'error'](
      response.ok ? 'Guest added' : 'Unable to add guest'
    );
    if (response.ok) onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Guest" size="lg">
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
        <div>
          <label className="flex items-center gap-2">
            <input name="vip" type="checkbox" className="rounded" />
            <span>VIP Guest</span>
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea name="notes" className="input-field w-full" rows={3} />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save Guest'}
          </button>
        </div>
      </form>
    </Modal>
  );
}