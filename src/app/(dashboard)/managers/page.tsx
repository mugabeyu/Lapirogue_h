'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import { Modal } from '@/components/Modal';
import { useApi } from '@/hooks/useApi';
import { toast } from 'sonner';
import { Plus, Pencil, SearchIcon, ShieldCheck, ShieldOff } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Manager, Department, User } from '@/types';

export default function ManagersPage() {
  const PAGE_SIZE = 15;
  const router = useRouter();
  const { data: managers, mutate } = useApi<Manager[]>('/api/managers');
  const { data: departments } = useApi<Department[]>('/api/departments');
  const { data: currentUser } = useApi<User>('/api/auth/me');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMgr, setEditMgr] = useState<Manager | null>(null);
  const [blockTarget, setBlockTarget] = useState<Manager | null>(null);
  const [isBlocking, setIsBlocking] = useState(false);

  const filtered = (managers ?? []).filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [m.firstName, m.lastName, m.email, m.managerId, m.departmentName]
      .filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const paginatedRows = filtered.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      id: editMgr?.id,
      firstName: String(formData.get('firstName') ?? '').trim(),
      lastName: String(formData.get('lastName') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim() || null,
      homeAddress: String(formData.get('homeAddress') ?? '').trim() || null,
      departmentId: String(formData.get('departmentId') ?? ''),
    };

    const response = await fetch('/api/managers', {
      method: editMgr ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      toast.error(result?.error ?? 'Failed to save manager');
      return;
    }

    toast.success(editMgr ? 'Manager updated' : 'Manager created. Invitation email sent.');
    setIsModalOpen(false);
    setEditMgr(null);
    await mutate();
  }

  async function handleBlockConfirm() {
    if (!blockTarget) return;
    setIsBlocking(true);
    const newStatus = !blockTarget.isActive;
    const response = await fetch('/api/managers', {
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
        isActive: newStatus,
      }),
    });

    setIsBlocking(false);
    if (!response.ok) {
      toast.error('Failed to update manager status');
      return;
    }

    toast.success(newStatus ? 'Manager unblocked' : 'Manager blocked');
    setBlockTarget(null);
    await mutate();
  }

  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Managers"
        subtitle={isAdmin ? 'Create, view, and manage manager accounts.' : 'View manager profiles.'}
        action={isAdmin ? (
          <Button variant="primary" onClick={() => { setEditMgr(null); setIsModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Manager
          </Button>
        ) : undefined}
      />

      <div className="card overflow-hidden">
        <div className="px-4 py-4 border-b border-border">
          <div className="relative w-full sm:w-96">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              type="search"
              placeholder="Search managers..."
              className="input-field pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-[var(--color-text-secondary)]">
            {search ? 'No managers match your search.' : 'No managers yet. Create the first manager account.'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                <th className="px-6 py-4 text-left font-medium">Manager</th>
                <th className="border-l border-border px-6 py-4 text-left font-medium">Manager ID</th>
                <th className="border-l border-border px-6 py-4 text-left font-medium">Email</th>
                <th className="border-l border-border px-6 py-4 text-left font-medium">Department</th>
                <th className="border-l border-border px-6 py-4 text-left font-medium">Status</th>
                {isAdmin && <th className="border-l border-border px-6 py-4 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((mgr) => (
                <tr
                  key={mgr.id}
                  className="border-b border-border transition-colors hover:bg-surface-secondary/50 cursor-pointer"
                  onClick={() => router.push(`/managers/${mgr.id}`)}
                >
                  <td className="px-6 py-4 text-sm font-medium text-[var(--color-text-primary)]">
                    {mgr.firstName} {mgr.lastName}
                  </td>
                  <td className="border-l border-border px-6 py-4 text-sm text-[var(--color-primary)] font-mono">
                    {mgr.managerId}
                  </td>
                  <td className="border-l border-border px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                    {mgr.email}
                  </td>
                  <td className="border-l border-border px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                    {mgr.departmentName || '-'}
                  </td>
                  <td className="border-l border-border px-6 py-4">
                    <StatusBadge status={mgr.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  {isAdmin && (
                    <td className="border-l border-border px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setEditMgr(mgr); setIsModalOpen(true); }}
                          className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-surface-secondary transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setBlockTarget(mgr)}
                          className={`rounded-lg p-2 transition-colors ${
                            mgr.isActive
                              ? 'text-[var(--color-text-secondary)] hover:bg-surface-secondary'
                              : 'text-[var(--color-danger)] hover:bg-danger/10'
                          }`}
                          title={mgr.isActive ? 'Block' : 'Unblock'}
                        >
                          {mgr.isActive ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filtered.length > PAGE_SIZE ? (
          <div className="table-footer">
            <span>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Previous
              </button>
              <button type="button" className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditMgr(null); }}
        title={editMgr ? 'Edit Manager' : 'Add Manager'}
        size="lg"
      >
        <form key={editMgr?.id ?? 'new'} onSubmit={handleSave} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">First Name</label>
              <input name="firstName" required className="input-field w-full" defaultValue={editMgr?.firstName ?? ''} readOnly={!!editMgr} tabIndex={editMgr ? -1 : undefined} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Last Name</label>
              <input name="lastName" required className="input-field w-full" defaultValue={editMgr?.lastName ?? ''} readOnly={!!editMgr} tabIndex={editMgr ? -1 : undefined} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Email</label>
              <input name="email" type="email" required className="input-field w-full" defaultValue={editMgr?.email ?? ''} readOnly={!!editMgr} tabIndex={editMgr ? -1 : undefined} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Phone</label>
              <input name="phone" className="input-field w-full" defaultValue={editMgr?.phone ?? ''} placeholder="+230 1234 5678" readOnly={!!editMgr} tabIndex={editMgr ? -1 : undefined} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Department</label>
              <select name="departmentId" required className="input-field w-full" defaultValue={editMgr?.departmentId ?? ''}>
                <option value="">Select department...</option>
                {departments?.filter((d) => d.isActive).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Home Address</label>
              <input name="homeAddress" className="input-field w-full" defaultValue={editMgr?.homeAddress ?? ''} readOnly={!!editMgr} tabIndex={editMgr ? -1 : undefined} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setIsModalOpen(false); setEditMgr(null); }}>Cancel</Button>
            <Button variant="primary" type="submit">{editMgr ? 'Update' : 'Create'} Manager</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(blockTarget)}
        title={blockTarget?.isActive ? 'Block Manager' : 'Unblock Manager'}
        message={`Do you want to ${blockTarget?.isActive ? 'block' : 'unblock'} ${blockTarget?.firstName ?? ''} ${blockTarget?.lastName ?? ''}?`}
        confirmLabel={blockTarget?.isActive ? 'Block' : 'Unblock'}
        onConfirm={handleBlockConfirm}
        onClose={() => setBlockTarget(null)}
        isLoading={isBlocking}
      />
    </div>
  );
}
