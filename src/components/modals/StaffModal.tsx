'use client';

import { FormEvent, useState } from 'react';
import { Modal } from '@/components/Modal';
import { toast } from 'sonner';
import { PhoneField } from '@/components/ui/PhoneField';
import { useApi } from '@/hooks/useApi';
import type { User } from '@/types';

type StaffRow = {
  id?: string;
  employeeCode?: string;
  name?: string;
  department?: string;
  position?: string;
  email?: string;
  phone?: string | null;
  status?: string;
  isMain?: boolean;
};

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
  editRow?: Record<string, unknown> | null;
}

export function StaffModal({ isOpen, onClose, onSaved, editRow }: StaffModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { data: currentUser } = useApi<User>('/api/auth/me');
  const staff = editRow as StaffRow | null;
  const isEdit = Boolean(staff?.id);
  const isEmailLocked = isEdit && currentUser?.role !== 'MAIN_RECEPTIONIST';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);

    const payload = {
      id: staff?.id,
      employeeCode: String(formData.get('employeeCode') ?? '').trim(),
      name: String(formData.get('name') ?? '').trim(),
      department: String(formData.get('department') ?? '').trim(),
      position: String(formData.get('position') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim() || undefined,
      status: String(formData.get('status') ?? 'ACTIVE'),
      isMain: formData.get('isMain') === 'on',
    };

    const response = await fetch('/api/staff', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setIsSaving(false);

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      toast.error(result?.error ?? 'Unable to save staff member');
      return;
    }

    toast.success(isEdit ? 'Staff updated' : 'Staff created');
    if (onSaved) await onSaved();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Staff Member' : 'Add Staff Member'} size="lg">
      <form key={staff?.id ?? 'new'} onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Employee code</label>
            <input name="employeeCode" required className="input-field w-full" defaultValue={staff?.employeeCode ?? ''} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Full name</label>
            <input name="name" required className="input-field w-full" defaultValue={staff?.name ?? ''} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Department</label>
            <input name="department" required className="input-field w-full" defaultValue={staff?.department ?? ''} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Position</label>
            <input name="position" required className="input-field w-full" defaultValue={staff?.position ?? ''} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Email</label>
            <input
              name="email"
              type="email"
              required
              className="input-field w-full"
              defaultValue={staff?.email ?? ''}
              disabled={isEmailLocked}
              aria-disabled={isEmailLocked}
            />
            {isEmailLocked ? <p className="mt-1 text-xs text-ink-500">Only admin users can update staff email addresses.</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Phone</label>
            <PhoneField name="phone" defaultValue={staff?.phone ?? ''} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Status</label>
            <select name="status" className="input-field w-full" defaultValue={staff?.status ?? 'ACTIVE'}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-sand-200 bg-sand-50/60 px-4 py-3 text-sm text-ink-700">
          <input
            type="checkbox"
            name="isMain"
            defaultChecked={Boolean(staff?.isMain)}
            className="mt-1 h-4 w-4 rounded border-sand-300 text-primary focus:ring-primary"
          />
          <span>
            Mark as main receptionist
            <span className="mt-1 block text-xs text-ink-500">Only one staff member should be the main receptionist at a time.</span>
          </span>
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Saving...' : isEdit ? 'Update Staff' : 'Add Staff'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
