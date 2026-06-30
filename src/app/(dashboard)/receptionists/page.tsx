'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import { Modal } from '@/components/Modal';
import { useApi } from '@/hooks/useApi';
import { toast } from 'sonner';
import { Plus, Pencil, SearchIcon, ShieldOff, ShieldCheck, UserCog, LayoutDashboard } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Receptionist, Department, Manager, User } from '@/types';

export default function ReceptionistsPage() {
  const router = useRouter();
  const { data: receptionists, mutate } = useApi<Receptionist[]>('/api/receptionists');
  const { data: departments } = useApi<Department[]>('/api/departments');
  const { data: managers } = useApi<Manager[]>('/api/managers');
  const { data: currentUser } = useApi<User>('/api/auth/me');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editRec, setEditRec] = useState<Receptionist | null>(null);
  const [blockTarget, setBlockTarget] = useState<Receptionist | null>(null);
  const [isBlocking, setIsBlocking] = useState(false);

  const isManager = currentUser?.role === 'MANAGER';

  const filtered = (receptionists ?? []).filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [r.firstName, r.lastName, r.email, r.employeeCode, r.departmentName]
      .filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      id: editRec?.id,
      firstName: String(formData.get('firstName') ?? '').trim(),
      lastName: String(formData.get('lastName') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim() || null,
      homeAddress: String(formData.get('homeAddress') ?? '').trim() || null,
      departmentId: String(formData.get('departmentId') ?? ''),
      managerId: String(formData.get('managerId') ?? ''),
    };

    const response = await fetch('/api/receptionists', {
      method: editRec ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      toast.error(result?.error ?? 'Failed to save receptionist');
      return;
    }

    toast.success(editRec ? 'Receptionist updated' : 'Receptionist created. Invitation email sent.');
    setIsModalOpen(false);
    setEditRec(null);
    await mutate();
  }

  async function handleBlockConfirm() {
    if (!blockTarget) return;
    setIsBlocking(true);
    const newStatus = !blockTarget.isActive;
    const response = await fetch('/api/receptionists', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: blockTarget.id,
        firstName: blockTarget.firstName,
        lastName: blockTarget.lastName,
        email: blockTarget.email,
        phone: blockTarget.phone,
        homeAddress: blockTarget.homeAddress,
        departmentId: blockTarget.departmentId,
        managerId: blockTarget.managerId,
        isActive: newStatus,
      }),
    });

    setIsBlocking(false);
    if (!response.ok) {
      toast.error('Failed to update receptionist status');
      return;
    }

    toast.success(newStatus ? 'Receptionist unblocked' : 'Receptionist blocked');
    setBlockTarget(null);
    await mutate();
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Receptionists"
        subtitle={isManager ? 'Create, view, and manage receptionist accounts.' : 'View receptionist profiles.'}
        action={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => router.push('/receptionists/room-board')}>
              <LayoutDashboard className="h-4 w-4 mr-2" /> Room Board
            </Button>
            {isManager && (
              <Button variant="primary" onClick={() => { setEditRec(null); setIsModalOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Add Receptionist
              </Button>
            )}
          </div>
        }
      />

      <div className="card overflow-hidden">
        <div className="px-4 py-4 border-b border-border">
          <div className="relative w-full sm:w-96">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              type="search"
              placeholder="Search receptionists..."
              className="input-field pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UserCog className="h-12 w-12 mx-auto mb-4 text-[var(--color-text-secondary)]" />
            <p className="text-[var(--color-text-secondary)]">
              {search ? 'No receptionists match your search.' : 'No receptionists yet. Add the first receptionist.'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                <th className="px-6 py-4 text-left font-medium">Name</th>
                <th className="border-l border-border px-6 py-4 text-left font-medium">Employee Code</th>
                <th className="border-l border-border px-6 py-4 text-left font-medium">Email</th>
                <th className="border-l border-border px-6 py-4 text-left font-medium">Department</th>
                <th className="border-l border-border px-6 py-4 text-left font-medium">Status</th>
                {isManager && <th className="border-l border-border px-6 py-4 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec) => (
                <tr
                  key={rec.id}
                  className="border-b border-border transition-colors hover:bg-surface-secondary/50 cursor-pointer"
                  onClick={() => router.push(`/receptionists/${rec.id}`)}
                >
                  <td className="px-6 py-4 text-sm font-medium text-[var(--color-text-primary)]">
                    {rec.firstName} {rec.lastName}
                  </td>
                  <td className="border-l border-border px-6 py-4 text-sm text-[var(--color-primary)] font-mono">
                    {rec.employeeCode}
                  </td>
                  <td className="border-l border-border px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                    {rec.email}
                  </td>
                  <td className="border-l border-border px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                    {rec.departmentName || '-'}
                  </td>
                  <td className="border-l border-border px-6 py-4">
                    <StatusBadge status={rec.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  {isManager && (
                    <td className="border-l border-border px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setEditRec(rec); setIsModalOpen(true); }}
                          className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-surface-secondary transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setBlockTarget(rec)}
                          className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-surface-secondary transition-colors"
                          title={rec.isActive ? 'Block' : 'Unblock'}
                        >
                          {rec.isActive ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditRec(null); }}
        title={editRec ? 'Edit Receptionist' : 'Add Receptionist'}
        size="lg"
      >
        <form key={editRec?.id ?? 'new'} onSubmit={handleSave} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">First Name</label>
              <input name="firstName" required className="input-field w-full" defaultValue={editRec?.firstName ?? ''} readOnly={!!editRec} tabIndex={editRec ? -1 : undefined} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Last Name</label>
              <input name="lastName" required className="input-field w-full" defaultValue={editRec?.lastName ?? ''} readOnly={!!editRec} tabIndex={editRec ? -1 : undefined} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Email</label>
              <input name="email" type="email" required className="input-field w-full" defaultValue={editRec?.email ?? ''} readOnly={!!editRec} tabIndex={editRec ? -1 : undefined} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Phone</label>
              <input name="phone" className="input-field w-full" defaultValue={editRec?.phone ?? ''} placeholder="+230 1234 5678" readOnly={!!editRec} tabIndex={editRec ? -1 : undefined} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Department</label>
              <select name="departmentId" required className="input-field w-full" defaultValue={editRec?.departmentId ?? ''}>
                <option value="">Select department...</option>
                {departments?.filter((d) => d.isActive).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Reporting Manager</label>
              <select name="managerId" required className="input-field w-full" defaultValue={editRec?.managerId ?? ''}>
                <option value="">Select manager...</option>
                {managers?.filter((m) => m.isActive).map((m) => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Home Address</label>
              <input name="homeAddress" className="input-field w-full" defaultValue={editRec?.homeAddress ?? ''} readOnly={!!editRec} tabIndex={editRec ? -1 : undefined} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setIsModalOpen(false); setEditRec(null); }}>Cancel</Button>
            <Button variant="primary" type="submit">{editRec ? 'Update' : 'Create'} Receptionist</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(blockTarget)}
        title={blockTarget?.isActive ? 'Block Receptionist' : 'Unblock Receptionist'}
        message={`Do you want to ${blockTarget?.isActive ? 'block' : 'unblock'} ${blockTarget?.firstName ?? ''} ${blockTarget?.lastName ?? ''}?`}
        confirmLabel={blockTarget?.isActive ? 'Block' : 'Unblock'}
        onConfirm={handleBlockConfirm}
        onClose={() => setBlockTarget(null)}
        isLoading={isBlocking}
      />
    </div>
  );
}
