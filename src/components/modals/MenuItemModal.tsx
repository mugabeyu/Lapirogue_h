'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { CloudUpload, Loader2, Trash2 } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MENU_CATEGORIES, MenuItemRecord } from '@/lib/menu';
import { uploadImage as uploadStoredImage } from '@/lib/upload-image';
import { toast } from 'sonner';

interface MenuItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
  editItem?: MenuItemRecord | null;
}

export function MenuItemModal({ isOpen, onClose, onSaved, editItem }: MenuItemModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(MENU_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [preparationMinutes, setPreparationMinutes] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  const isEdit = Boolean(editItem?.id);

  useEffect(() => {
    if (!isOpen) return;
    setImageFile(null);
    setName(editItem?.name ?? '');
    setCategory(editItem?.category ?? MENU_CATEGORIES[0]);
    setDescription(editItem?.description ?? '');
    setPrice(editItem?.price !== undefined ? String(editItem.price) : '');
    setPreparationMinutes(
      editItem?.preparationMinutes !== undefined && editItem.preparationMinutes !== null
        ? String(editItem.preparationMinutes)
        : '',
    );
    setIsAvailable(editItem?.isAvailable !== false);
    setImagePreview(editItem?.imagePath ?? null);
  }, [isOpen, editItem]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5MB or smaller');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function uploadMenuImage(itemId: string) {
    if (!imageFile) return editItem?.imagePath;
    return uploadStoredImage({ file: imageFile, bucket: 'menu-images', id: itemId, target: 'menu-item' });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    const payload = {
      name: name.trim(),
      category,
      description: description.trim() || null,
      price: Number(price) || 0,
      preparationMinutes: preparationMinutes.trim() ? Number(preparationMinutes) : null,
      isAvailable,
    };

    const response = await fetch('/api/menu-items', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit ? { id: editItem!.id, ...payload } : payload),
    });

    const result = await response.json();
    if (!response.ok) {
      setIsSaving(false);
      toast.error(result.error ?? 'Unable to save menu item');
      return;
    }

    const itemId = (isEdit ? editItem!.id : result.data?.id) as string;
    if (imageFile && itemId) {
      try {
        const url = await uploadMenuImage(itemId);
        if (url) {
          // Persist image path on the menu item record
          await fetch('/api/menu-items', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: itemId, imagePath: url }),
          });
        }
      } catch {
        setIsSaving(false);
        toast.error('Menu item saved, but the image upload failed');
        return;
      }
    }

    setIsSaving(false);
    toast.success(isEdit ? 'Menu item updated' : 'Menu item added');
    if (onSaved) await onSaved();
    onClose();
  }

  async function handleDelete() {
    if (!editItem?.id) return;
    setIsDeleting(true);
    const response = await fetch(`/api/menu-items?id=${editItem.id}`, { method: 'DELETE' });
    setIsDeleting(false);
    setConfirmDelete(false);

    if (!response.ok) {
      toast.error('Unable to delete menu item');
      return;
    }

    toast.success('Menu item deleted');
    if (onSaved) await onSaved();
    onClose();
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? 'Edit menu item' : 'Add menu item'}
        subtitle="Add a photo, prep time, and pricing for this dish."
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
            <div className="space-y-2">
              <span className="text-sm font-medium text-ink-700">Item photo</span>
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-sand-300 bg-sand-50/60 text-center transition-colors hover:border-primary/40 hover:bg-sand-50">
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <>
                    <CloudUpload className="mb-2 h-7 w-7 text-ink-400" />
                    <span className="px-3 text-xs font-medium text-ink-600">Upload photo</span>
                    <span className="mt-1 px-3 text-[11px] text-ink-500">PNG, JPG up to 5MB</span>
                  </>
                )}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
              </label>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-medium text-ink-700">Name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    className="input-field w-full"
                    placeholder="e.g. Rougaille Saucisses"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-ink-700">Category</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    required
                    className="input-field w-full"
                  >
                    {MENU_CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-ink-700">Price (Rs)</span>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    required
                    className="input-field w-full"
                    placeholder="650"
                  />
                </label>
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-medium text-ink-700">Preparation time (minutes)</span>
                  <input
                    type="number"
                    min={0}
                    value={preparationMinutes}
                    onChange={(event) => setPreparationMinutes(event.target.value)}
                    className="input-field w-full max-w-xs"
                    placeholder="e.g. 25"
                  />
                </label>
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-medium text-ink-700">Description</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    className="input-field w-full resize-none"
                    placeholder="Short description for the menu card..."
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-sand-200 bg-sand-50/50 px-3 py-2.5 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(event) => setIsAvailable(event.target.checked)}
                  className="h-4 w-4 rounded border-sand-300 text-primary focus:ring-primary"
                />
                Available on menu
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sand-200 pt-4">
            {isEdit ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-2 text-sm font-medium text-danger hover:underline"
              >
                <Trash2 className="h-4 w-4" />
                Delete item
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSaving ? 'Saving...' : isEdit ? 'Update item' : 'Add item'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete menu item"
        message={`Remove "${editItem?.name}" from the menu? This cannot be undone.`}
        isLoading={isDeleting}
      />
    </>
  );
}
