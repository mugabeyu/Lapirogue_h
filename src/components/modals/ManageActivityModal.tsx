'use client';

import { FormEvent, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { ACTIVITY_CATEGORIES, ActivityListItem } from '@/lib/activities';

interface ManageActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: ActivityListItem;
  onSaved: () => void | Promise<void>;
}

/**
 * Edit / delete for a single activity, opened from the manage control on its
 * card.
 *
 * Deletion is refused while bookings still reference the activity — the API
 * enforces that, and the button is disabled here too so the reason is visible
 * before the click rather than as an error afterwards.
 */
export function ManageActivityModal({
  isOpen,
  onClose,
  activity,
  onSaved,
}: ManageActivityModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const bookingCount = activity.activeBookingCount ?? 0;
  const canDelete = bookingCount === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);

    const response = await fetch('/api/activities', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        id: activity.id,
        name: formData.get('name'),
        category: formData.get('category'),
        description: formData.get('description') || undefined,
        price: Number(formData.get('price')),
        capacity: Number(formData.get('capacity')),
        durationLabel: formData.get('durationLabel') || undefined,
        meetingPoint: formData.get('meetingPoint') || undefined,
        defaultTime: formData.get('defaultTime') || undefined,
        status: formData.get('status'),
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      toast.error(error.error || 'Unable to update activity');
      return;
    }

    toast.success('Activity updated');
    await onSaved();
    onClose();
  }

  async function handleDelete() {
    setIsDeleting(true);
    const response = await fetch(`/api/activities?id=${activity.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    setIsDeleting(false);
    setConfirmDelete(false);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      toast.error(error.error || 'Unable to delete activity');
      return;
    }

    toast.success('Activity deleted');
    await onSaved();
    onClose();
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Edit Activity" size="lg">
        <form key={activity.id} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Name</label>
            <input id="name" name="name" required className="input-field w-full" defaultValue={activity.name} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="category" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Category</label>
              <select id="category" name="category" required className="input-field w-full" defaultValue={activity.category}>
                {/* An activity sitting on a category no longer in the standard
                    list keeps it, so saving cannot silently recategorise it. */}
                {!(ACTIVITY_CATEGORIES as readonly string[]).includes(activity.category) && (
                  <option value={activity.category}>{activity.category}</option>
                )}
                {ACTIVITY_CATEGORIES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Status</label>
              <select id="status" name="status" className="input-field w-full" defaultValue={activity.status}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="FULL">Full</option>
              </select>
            </div>
            <div>
              <label htmlFor="price" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Price (Rs)</label>
              <input id="price" name="price" type="number" min="0" step="1" required className="input-field w-full" defaultValue={activity.price} />
            </div>
            <div>
              <label htmlFor="capacity" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Capacity</label>
              <input id="capacity" name="capacity" type="number" min="1" required className="input-field w-full" defaultValue={activity.capacity} />
            </div>
            <div>
              <label htmlFor="durationLabel" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Duration</label>
              <input id="durationLabel" name="durationLabel" className="input-field w-full" defaultValue={activity.durationLabel} placeholder="e.g. 3 Hours" />
            </div>
            <div>
              <label htmlFor="defaultTime" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Default start time</label>
              {/* Stored as HH:MM:SS; a time input only accepts HH:MM. */}
              <input id="defaultTime" name="defaultTime" type="time" className="input-field w-full" defaultValue={activity.defaultTime?.slice(0, 5)} />
            </div>
          </div>

          <div>
            <label htmlFor="meetingPoint" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Meeting point</label>
            <input id="meetingPoint" name="meetingPoint" className="input-field w-full" defaultValue={activity.meetingPoint ?? ''} />
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Description</label>
            <textarea id="description" name="description" rows={3} className="input-field w-full" defaultValue={activity.description ?? ''} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={!canDelete || isDeleting}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-danger)] px-4 py-2 text-sm font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--color-danger)]"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              {!canDelete && (
                <p className="mt-2 max-w-xs text-xs text-[var(--color-text-secondary)]">
                  {bookingCount === 1
                    ? 'Cannot delete: 1 booking references this activity. Cancel it first.'
                    : `Cannot delete: ${bookingCount} bookings reference this activity. Cancel them first.`}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete activity"
        message={`Delete "${activity.name}"? This cannot be undone.`}
        confirmLabel="Delete activity"
        isLoading={isDeleting}
      />
    </>
  );
}
