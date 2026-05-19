'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { toast } from 'sonner';
import { Room, RoomType } from '@/types';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
  editRow?: Record<string, unknown> | null;
}

const roomTypes: RoomType[] = ['STANDARD', 'DELUXE', 'SUITE', 'VILLA'];

export function RoomModal({ isOpen, onClose, onSaved, editRow }: RoomModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const room = editRow as Room | null;
  const isEdit = Boolean(room?.id);

  useEffect(() => {
    if (!isOpen) return;
  }, [isOpen, room?.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);

    const payload = {
      id: room?.id,
      roomNumber: formData.get('roomNumber'),
      type: formData.get('type'),
      floor: formData.get('floor') || undefined,
      capacity: Number(formData.get('capacity')),
      price: Number(formData.get('price')),
      status: formData.get('status') || 'AVAILABLE',
      description: formData.get('description') || undefined,
    };

    const response = await fetch('/api/rooms', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setIsSaving(false);
    toast[response.ok ? 'success' : 'error'](
      response.ok ? (isEdit ? 'Room updated' : 'Room created') : 'Unable to save room',
    );

    if (response.ok) {
      if (onSaved) await onSaved();
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Room' : 'Add Room'} size="lg">
      <form key={room?.id ?? 'new'} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Room number</label>
            <input name="roomNumber" required className="input-field w-full" defaultValue={room?.roomNumber} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Type</label>
            <select name="type" required className="input-field w-full" defaultValue={room?.type ?? 'STANDARD'}>
              {roomTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Floor</label>
            <input name="floor" className="input-field w-full" defaultValue={room?.floor ?? ''} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Capacity</label>
            <input name="capacity" type="number" min="1" required className="input-field w-full" defaultValue={room?.capacity ?? 2} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Price per night</label>
            <input name="price" type="number" min="0" required className="input-field w-full" defaultValue={room?.price ?? ''} />
          </div>
          {isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">Status</label>
              <select name="status" className="input-field w-full" defaultValue={room?.status ?? 'AVAILABLE'}>
                <option value="AVAILABLE">Available</option>
                <option value="OCCUPIED">Occupied</option>
                <option value="CLEANING">Cleaning</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">Description</label>
          <textarea name="description" className="input-field w-full" rows={3} defaultValue={room?.description ?? ''} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Saving...' : isEdit ? 'Update Room' : 'Add Room'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
