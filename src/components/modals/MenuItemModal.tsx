'use client';

import { FormEvent, useState } from 'react';
import { Modal } from '@/components/Modal';
import { toast } from 'sonner';
import { MenuItem } from '@/types';

interface MenuItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
  editRow?: Record<string, unknown> | null;
}

export function MenuItemModal({ isOpen, onClose, onSaved, editRow }: MenuItemModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const item = editRow as MenuItem | null;
  const isEdit = Boolean(item?.id);
  const isAvailable = item ? item.isAvailable !== false : true;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);

    const payload = {
      id: item?.id,
      name: formData.get('name'),
      category: formData.get('category'),
      description: formData.get('description'),
      price: Number(formData.get('price')),
      isAvailable: formData.get('isAvailable') === 'on',
    };

    const response = await fetch('/api/menu-items', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setIsSaving(false);
    toast[response.ok ? 'success' : 'error'](
      response.ok ? (isEdit ? 'Menu item updated' : 'Menu item created') : 'Unable to save menu item',
    );

    if (response.ok) {
      if (onSaved) await onSaved();
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Menu Item' : 'Add Menu Item'} size="lg">
      <form key={item?.id ?? 'new'} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Name</label>
            <input name="name" required className="input-field w-full" defaultValue={item?.name} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Category</label>
            <input name="category" required className="input-field w-full" defaultValue={item?.category} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">Description</label>
          <textarea name="description" className="input-field w-full" rows={2} defaultValue={item?.description ?? ''} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">Price</label>
          <input name="price" type="number" min="0" required className="input-field w-full" defaultValue={item?.price ?? ''} />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" name="isAvailable" defaultChecked={isAvailable} className="rounded border-sand-300" />
          Available on menu
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Saving...' : isEdit ? 'Update Item' : 'Add Item'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
