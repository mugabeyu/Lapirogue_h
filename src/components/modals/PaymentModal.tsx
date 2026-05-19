'use client';

import { FormEvent, useState } from 'react';
import { Modal } from '@/components/Modal';
import { toast } from 'sonner';
import { useApi } from '@/hooks/useApi';
import { PaymentMethod, PaymentStatus } from '@/types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
  editRow?: Record<string, unknown> | null;
}

type ReservationOption = {
  id: string;
  reservationId: string | null;
  guest: string | null;
  room: string | null;
};

const paymentMethods: PaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE'];
const paymentStatuses: PaymentStatus[] = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];

export function PaymentModal({ isOpen, onClose, onSaved, editRow }: PaymentModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = Boolean(editRow?.id);
  const { data: reservations } = useApi<ReservationOption[]>('/api/reservations');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);

    const payload = {
      id: editRow?.id,
      reservationId: formData.get('reservationId'),
      amount: Number(formData.get('amount')),
      method: formData.get('method'),
      status: formData.get('status'),
      reference: formData.get('reference') || undefined,
      notes: formData.get('notes') || undefined,
    };

    const response = await fetch('/api/payments', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setIsSaving(false);
    toast[response.ok ? 'success' : 'error'](
      response.ok ? (isEdit ? 'Payment updated' : 'Payment recorded') : 'Unable to save payment',
    );

    if (response.ok) {
      if (onSaved) await onSaved();
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Payment' : 'Record Payment'} size="lg">
      <form key={String(editRow?.id ?? 'new')} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">Reservation</label>
          <select
            name="reservationId"
            required
            className="input-field w-full"
            defaultValue={String(editRow?.reservationId ?? '')}
          >
            <option value="">Select reservation</option>
            {(reservations ?? []).map((reservation) => (
              <option key={reservation.id} value={reservation.id}>
                {reservation.reservationId ?? reservation.id}
                {reservation.guest ? ` — ${reservation.guest}` : ''}
                {reservation.room ? ` (Room ${reservation.room})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Amount</label>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              className="input-field w-full"
              defaultValue={Number(editRow?.amount ?? 0) || ''}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Method</label>
            <select name="method" required className="input-field w-full" defaultValue={String(editRow?.method ?? 'CASH')}>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Status</label>
            <select name="status" required className="input-field w-full" defaultValue={String(editRow?.status ?? 'PENDING')}>
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Reference</label>
            <input name="reference" className="input-field w-full" defaultValue={String(editRow?.reference ?? '')} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">Notes</label>
          <textarea name="notes" className="input-field w-full" rows={2} defaultValue={String(editRow?.notes ?? '')} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Saving...' : isEdit ? 'Update Payment' : 'Save Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
