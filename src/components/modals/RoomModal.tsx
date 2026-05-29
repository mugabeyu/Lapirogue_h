'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/Modal';
import { uploadImage } from '@/lib/upload-image';
import { CloudUpload, Plus, X } from 'lucide-react';
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
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const room = editRow as Room | null;
  const isEdit = Boolean(room?.id);

  const galleryImages = useMemo(
    () => [...existingImages, ...pendingFiles.map((entry) => entry.previewUrl)],
    [existingImages, pendingFiles],
  );

  useEffect(() => {
    if (!isOpen) return;
    setExistingImages(room?.imagePaths?.length ? room.imagePaths : room?.imagePath ? [room.imagePath] : []);
    setPendingFiles([]);
  }, [isOpen, room?.id, room?.imagePath, room?.imagePaths]);

  useEffect(() => {
    return () => {
      pendingFiles.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
    };
  }, [pendingFiles]);

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const acceptedFiles = files.filter((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`Image ${file.name} must be 5MB or smaller`);
        return false;
      }
      return true;
    });

    setPendingFiles((current) => [
      ...current,
      ...acceptedFiles.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
    event.target.value = '';
  }

  function removePendingFile(previewUrl: string) {
    setPendingFiles((current) => {
      const next = current.filter((entry) => entry.previewUrl !== previewUrl);
      const removed = current.find((entry) => entry.previewUrl === previewUrl);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

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
      imagePath: existingImages[0] ?? undefined,
      imagePaths: existingImages,
    };

    const response = await fetch('/api/rooms', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      const roomId = (result.data?.id as string | undefined) ?? room?.id;

      if (roomId && pendingFiles.length > 0) {
        const uploaded: string[] = [];
        for (const entry of pendingFiles) {
          const url = await uploadImage({ file: entry.file, bucket: 'room-images', id: roomId, target: 'room' });
          if (url) uploaded.push(url);
        }

        if (uploaded.length > 0) {
          const updated = Array.from(new Set([...(existingImages ?? []), ...uploaded]));
          // Persist the full room payload again so the image paths are saved with the rest of the room data.
          await fetch('/api/rooms', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              id: roomId,
              imagePath: updated[0],
              imagePaths: updated,
            }),
          });
          setExistingImages(updated);
        }
      }

      if (onSaved) await onSaved();
      onClose();
    }

    setIsSaving(false);
    toast[response.ok ? 'success' : 'error'](
      response.ok ? (isEdit ? 'Room updated' : 'Room created') : 'Unable to save room',
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Room' : 'Add Room'} size="lg">
      <form key={room?.id ?? 'new'} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-ink-700">Room photos</label>
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-sand-300 bg-sand-50/70 px-4 py-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/5">
            <CloudUpload className="h-8 w-8 text-ink-400" />
            <div>
              <div className="text-sm font-medium text-ink-800">Upload one or more room photos</div>
              <div className="mt-1 text-xs text-ink-500">Preview images before saving the room record</div>
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleFileSelect} disabled={isSaving} />
          </label>

          {galleryImages.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              {existingImages.map((imageUrl) => (
                <div key={imageUrl} className="group relative overflow-hidden rounded-xl border border-sand-200 bg-white">
                  <img src={imageUrl} alt="Room photo" className="h-28 w-full object-cover" />
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-ink-700">
                    Saved
                  </span>
                </div>
              ))}
              {pendingFiles.map((entry) => (
                <div key={entry.previewUrl} className="group relative overflow-hidden rounded-xl border border-sand-200 bg-white">
                  <img src={entry.previewUrl} alt={entry.file.name} className="h-28 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePendingFile(entry.previewUrl)}
                    className="absolute right-2 top-2 rounded-full bg-black/65 p-1 text-white opacity-100 transition-opacity group-hover:bg-black/80"
                    aria-label="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-ink-700">
                    New
                  </span>
                </div>
              ))}
              <label className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-sand-300 bg-sand-50 text-ink-500 transition-colors hover:border-primary/40 hover:bg-primary/5">
                <Plus className="h-5 w-5" />
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleFileSelect} disabled={isSaving} />
              </label>
            </div>
          )}
        </div>
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
