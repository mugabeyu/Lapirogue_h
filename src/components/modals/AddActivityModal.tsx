'use client';

import { FormEvent, useState } from 'react';
import { Modal } from '@/components/Modal';
import { toast } from 'sonner';
import { Activity } from '@/types';

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
  editRow?: Record<string, unknown> | null;
}

export function AddActivityModal({ isOpen, onClose, onSaved, editRow }: AddActivityModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const activity = editRow as Activity | null;
  const isEdit = Boolean(activity?.id);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);

    const payload = {
      id: activity?.id,
      name: formData.get('name'),
      category: formData.get('category'),
      description: formData.get('description'),
      price: Number(formData.get('price')),
      duration: Number(formData.get('duration')),
      capacity: Number(formData.get('capacity')),
      status: formData.get('status') || 'ACTIVE',
    };

    const response = await fetch('/api/activities', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setIsSaving(false);
    toast[response.ok ? 'success' : 'error'](
      response.ok ? (isEdit ? 'Activity updated' : 'Activity saved') : 'Unable to save activity',
    );

    if (response.ok) {
      if (onSaved) await onSaved();
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Activity' : 'Add Activity'} size="lg">
      <form key={activity?.id ?? 'new'} onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Activity name</label>
            <input name="name" required className="input-field w-full" defaultValue={activity?.name} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Category</label>
            <input name="category" required className="input-field w-full" defaultValue={activity?.category} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">Description</label>
          <textarea name="description" className="input-field w-full min-h-32" defaultValue={activity?.description ?? ''} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Price</label>
            <input name="price" required type="number" min="0" className="input-field w-full" defaultValue={activity?.price ?? ''} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Duration minutes</label>
            <input name="duration" required type="number" min="1" className="input-field w-full" defaultValue={activity?.duration ?? 60} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Capacity</label>
            <input name="capacity" required type="number" min="1" className="input-field w-full" defaultValue={activity?.capacity ?? 10} />
          </div>
        </div>

        {isEdit && (
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Status</label>
            <select name="status" className="input-field w-full" defaultValue={activity?.status ?? 'ACTIVE'}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="FULL">Full</option>
            </select>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Saving...' : isEdit ? 'Update Activity' : 'Save Activity'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
