'use client';

import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';

export default function AddActivityPage() {
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);

    const response = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.get('name'),
        category: formData.get('category'),
        description: formData.get('description'),
        price: Number(formData.get('price')),
        duration: Number(formData.get('duration')),
        capacity: Number(formData.get('capacity')),
      }),
    });

    setIsSaving(false);
    toast[response.ok ? 'success' : 'error'](
      response.ok ? 'Activity saved' : 'Unable to save activity',
    );
  }

  return (
    <div className="max-w-3xl space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Add Activity" />
      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <input name="name" required className="input-field" placeholder="Activity name" />
        <input name="category" required className="input-field" placeholder="Category" />
        <textarea name="description" className="input-field min-h-32" placeholder="Description" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input name="price" required type="number" min="0" className="input-field" placeholder="Price" />
          <input name="duration" required type="number" min="1" className="input-field" placeholder="Duration minutes" />
          <input name="capacity" required type="number" min="1" className="input-field" placeholder="Capacity" />
        </div>
        <button disabled={isSaving} className="btn-primary disabled:opacity-50">
          {isSaving ? 'Saving...' : 'Save Activity'}
        </button>
      </form>
    </div>
  );
}
