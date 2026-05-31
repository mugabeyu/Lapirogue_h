'use client';

import { FormEvent, useState } from 'react';
import { Modal } from '@/components/Modal';
import { useApi } from '@/hooks/useApi';
import { MenuItem } from '@/types';
import { toast } from 'sonner';

interface AddFoodOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddFoodOrderModal({ isOpen, onClose }: AddFoodOrderModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { data: menuItems } = useApi<MenuItem[]>('/api/menu-items');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);
    const menuItemId = String(formData.get('menuItemId'));
    const item = (menuItems ?? []).find((menuItem) => menuItem.id === menuItemId);
    const quantity = Number(formData.get('quantity'));

    const response = await fetch('/api/food-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: item ? [{ id: item.id, name: item.name, quantity, price: item.price }] : [],
        total: item ? item.price * quantity : 0,
        notes: formData.get('notes'),
      }),
    });

    setIsSaving(false);
    toast[response.ok ? 'success' : 'error'](
      response.ok ? 'Order saved' : 'Unable to save order',
    );

    if (response.ok) {
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record F&B Order" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <select name="menuItemId" required className="input-field w-full">
          <option value="">Select menu item</option>
          {(menuItems ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Quantity</label>
            <input name="quantity" required type="number" min="1" className="input-field w-full" defaultValue="1" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Notes</label>
            <input name="notes" className="input-field w-full" placeholder="Room service instructions" />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save Order'}
          </button>
        </div>
      </form>
    </Modal>
  );
}