'use client';

import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { useApi } from '@/hooks/useApi';

type MenuItem = {
  id: string;
  name: string;
  price: number;
};

export default function AddFoodOrderPage() {
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
  }

  return (
    <div className="max-w-3xl space-y-6 animate-in fade-in duration-500">
      <PageHeader title="New Food Order" />
      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <select name="menuItemId" required className="input-field">
          <option value="">Select menu item</option>
          {(menuItems ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <input name="quantity" required type="number" min="1" className="input-field" placeholder="Quantity" />
        <textarea name="notes" className="input-field min-h-24" placeholder="Notes" />
        <button disabled={isSaving} className="btn-primary disabled:opacity-50">
          {isSaving ? 'Saving...' : 'Save Order'}
        </button>
      </form>
    </div>
  );
}
