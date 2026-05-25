'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/Modal';
import { toast } from 'sonner';
import { GuestSearchPicker } from '@/components/pickers/GuestSearchPicker';
import { Guest, PaymentMethod, PaymentStatus } from '@/types';
import { Plus, X } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
  editRow?: Record<string, unknown> | null;
}

const paymentMethods: PaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE'];
const paymentStatuses: PaymentStatus[] = ['PENDING', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'];

type ExtraChargeCategory = 'Transport services' | 'Laundry/services' | 'Additional hotel purchases';

type ExtraChargeInput = {
  id: string;
  category: ExtraChargeCategory;
  label: string;
  amount: string;
};

type GuestBillingSummary = {
  totalCharges: number;
  totalPaid: number;
  balanceDue: number;
  status: string;
  totals: Record<string, number>;
};

export function PaymentModal({ isOpen, onClose, onSaved, editRow }: PaymentModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [billingSummary, setBillingSummary] = useState<GuestBillingSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [extraCharges, setExtraCharges] = useState<ExtraChargeInput[]>([]);
  const isEdit = Boolean(editRow?.id);

  const extrasTotal = useMemo(
    () => extraCharges.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [extraCharges],
  );
  const autoAmountDue = useMemo(
    () => Math.max(0, Number(billingSummary?.balanceDue ?? 0)) + extrasTotal,
    [billingSummary?.balanceDue, extrasTotal],
  );

  useEffect(() => {
    if (!isOpen) {
      if (!isEdit) setGuest(null);
      setBillingSummary(null);
      setExtraCharges([]);
      return;
    }
    if (!editRow?.guestId) {
      if (!isEdit) setGuest(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/guests/${editRow.guestId}`)
      .then((response) => response.json())
      .then((result) => {
        if (!cancelled && result.success && result.data) {
          setGuest(result.data as Guest);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isOpen, isEdit, editRow?.guestId]);

  useEffect(() => {
    if (!guest?.id || !isOpen) {
      setBillingSummary(null);
      return;
    }

    let cancelled = false;
    setIsLoadingSummary(true);
    fetch(`/api/guests/${guest.id}/profile`)
      .then((response) => response.json())
      .then((result) => {
        if (cancelled) return;
        if (result?.success && result?.data?.billingSummary) {
          setBillingSummary(result.data.billingSummary as GuestBillingSummary);
          return;
        }
        setBillingSummary(null);
      })
      .catch(() => {
        if (!cancelled) setBillingSummary(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSummary(false);
      });

    return () => {
      cancelled = true;
    };
  }, [guest?.id, isOpen]);

  function addExtraCharge() {
    setExtraCharges((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        category: 'Additional hotel purchases',
        label: '',
        amount: '',
      },
    ]);
  }

  function updateExtraCharge(id: string, patch: Partial<ExtraChargeInput>) {
    setExtraCharges((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeExtraCharge(id: string) {
    setExtraCharges((current) => current.filter((item) => item.id !== id));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guest) {
      toast.error('Please select a guest');
      return;
    }

    setIsSaving(true);
    const formData = new FormData(event.currentTarget);

    const payload = {
      id: editRow?.id,
      guestId: guest.id,
      amount: autoAmountDue,
      method: formData.get('method'),
      status: formData.get('status'),
      reference: formData.get('reference') || undefined,
      notes: formData.get('notes') || undefined,
      extraCharges: extraCharges
        .map((item) => ({
          category: item.category,
          label: item.label.trim(),
          amount: Number(item.amount),
        }))
        .filter((item) => item.label && item.amount > 0),
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
      <form key={String(editRow?.id ?? 'new')} onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h3 className="mb-3 font-display text-lg text-ink-900">Select Guest</h3>
          <GuestSearchPicker selectedId={guest?.id ?? ''} onSelect={setGuest} />
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-sand-200 pt-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Amount (Auto calculated)</label>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              className="input-field w-full"
              value={Number.isFinite(autoAmountDue) ? autoAmountDue : 0}
              readOnly
            />
            <p className="mt-1 text-xs text-ink-500">
              {isLoadingSummary
                ? 'Calculating guest balance...'
                : `Outstanding balance + extra charges = Rs ${autoAmountDue.toLocaleString()}`}
            </p>
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

        {guest && (
          <div className="rounded-xl border border-sand-200 bg-sand-50/70 p-4">
            <div className="text-sm font-semibold text-ink-900">Auto billing summary</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-ink-700">
              <div>Room charges</div>
              <div className="text-right">Rs {Number(billingSummary?.totals?.['Room charges'] ?? 0).toLocaleString()}</div>
              <div>Food & Beverage</div>
              <div className="text-right">Rs {Number(billingSummary?.totals?.['Food & Beverage orders'] ?? 0).toLocaleString()}</div>
              <div>Tours and activities</div>
              <div className="text-right">Rs {Number(billingSummary?.totals?.['Tours and activities'] ?? 0).toLocaleString()}</div>
              <div>Taxes/service charges</div>
              <div className="text-right">Rs {Number(billingSummary?.totals?.['Taxes and service charges'] ?? 0).toLocaleString()}</div>
              <div className="font-semibold text-ink-900">Outstanding balance</div>
              <div className="text-right font-semibold text-ink-900">
                Rs {Number(billingSummary?.balanceDue ?? 0).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-sand-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink-900">Extra payments / additional charges</h4>
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={addExtraCharge}>
              <Plus className="h-4 w-4" />
              Add Extra
            </button>
          </div>
          <div className="space-y-3">
            {extraCharges.length === 0 ? (
              <p className="text-sm text-ink-500">No extra charges added.</p>
            ) : (
              extraCharges.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 rounded-lg border border-sand-200 bg-sand-50/60 p-2">
                  <select
                    className="input-field col-span-4"
                    value={item.category}
                    onChange={(event) => updateExtraCharge(item.id, { category: event.target.value as ExtraChargeCategory })}
                  >
                    <option value="Transport services">Transport services</option>
                    <option value="Laundry/services">Laundry/services</option>
                    <option value="Additional hotel purchases">Additional hotel purchases</option>
                  </select>
                  <input
                    className="input-field col-span-4"
                    placeholder="Description"
                    value={item.label}
                    onChange={(event) => updateExtraCharge(item.id, { label: event.target.value })}
                  />
                  <input
                    className="input-field col-span-3"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Amount"
                    value={item.amount}
                    onChange={(event) => updateExtraCharge(item.id, { amount: event.target.value })}
                  />
                  <button
                    type="button"
                    className="col-span-1 inline-flex items-center justify-center rounded-md border border-sand-300 bg-white text-ink-600 hover:text-red-600"
                    onClick={() => removeExtraCharge(item.id)}
                    aria-label="Remove extra charge"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 text-right text-sm font-medium text-ink-800">Extra total: Rs {extrasTotal.toLocaleString()}</div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">Notes</label>
          <textarea name="notes" className="input-field w-full" rows={2} defaultValue={String(editRow?.notes ?? '')} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving || !guest} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Saving...' : isEdit ? 'Update Payment' : 'Save Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
