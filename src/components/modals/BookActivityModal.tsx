'use client';

import { FormEvent, useState } from 'react';
import { Modal } from '@/components/Modal';
import { toast } from 'sonner';

interface BookActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityId: string;
  guestId?: string;
}

export function BookActivityModal({ isOpen, onClose, activityId, guestId }: BookActivityModalProps) {
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch('/api/activities/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityId,
        guestId: guestId || formData.get('guestId'),
        date: formData.get('date'),
        participants: Number(formData.get('participants')),
      }),
    });

    setIsSaving(false);
    toast[response.ok ? 'success' : 'error'](
      response.ok ? 'Activity booked' : 'Unable to book activity'
    );
    if (response.ok) onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Book Activity">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Guest ID</label>
          <input
            name="guestId"
            defaultValue={guestId}
            required
            className="input-field w-full"
            placeholder="Guest ID"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input name="date" type="date" required className="input-field w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Participants</label>
          <input
            name="participants"
            type="number"
            min="1"
            defaultValue="1"
            required
            className="input-field w-full"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Booking...' : 'Book Activity'}
          </button>
        </div>
      </form>
    </Modal>
  );
}