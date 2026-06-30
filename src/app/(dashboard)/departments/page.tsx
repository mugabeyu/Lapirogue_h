'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useApi } from '@/hooks/useApi';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import type { Department } from '@/types';

export default function DepartmentsPage() {
  const { data: departments, mutate } = useApi<Department[]>('/api/departments');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      id: editDept?.id,
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim() || null,
    };

    const response = await fetch('/api/departments', {
      method: editDept ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      toast.error(result?.error ?? 'Failed to save department');
      return;
    }

    toast.success(editDept ? 'Department updated' : 'Department created');
    setIsModalOpen(false);
    setEditDept(null);
    await mutate();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const response = await fetch(`/api/departments?id=${deleteId}`, { method: 'DELETE' });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      toast.error(result?.error ?? 'Failed to delete department');
      return;
    }
    toast.success('Department deleted');
    setDeleteId(null);
    await mutate();
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Departments"
        subtitle="Create and manage hotel departments."
        action={
          <Button variant="primary" onClick={() => { setEditDept(null); setIsModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Department
          </Button>
        }
      />

      <div className="card overflow-hidden">
        {(!departments || departments.length === 0) ? (
          <div className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-[var(--color-text-secondary)]" />
            <p className="text-[var(--color-text-secondary)] mb-4">No departments yet. Create your first department.</p>
            <Button variant="primary" onClick={() => { setEditDept(null); setIsModalOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Create Department
            </Button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                <th className="px-6 py-4 text-left font-medium">Name</th>
                <th className="border-l border-border px-6 py-4 text-left font-medium">Description</th>
                <th className="border-l border-border px-6 py-4 text-left font-medium">Status</th>
                <th className="border-l border-border px-6 py-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments?.map((dept) => (
                <tr key={dept.id} className="border-b border-border transition-colors hover:bg-surface-secondary/50">
                  <td className="px-6 py-4 text-sm font-medium text-[var(--color-text-primary)]">{dept.name}</td>
                  <td className="border-l border-border px-6 py-4 text-sm text-[var(--color-text-secondary)]">{dept.description || '-'}</td>
                  <td className="border-l border-border px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${dept.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>
                      {dept.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="border-l border-border px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setEditDept(dept); setIsModalOpen(true); }}
                        className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-surface-secondary transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(dept.id)}
                        className="rounded-lg p-2 text-[var(--color-danger)] hover:bg-surface-secondary transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditDept(null); }}
        title={editDept ? 'Edit Department' : 'Add Department'}
        size="md"
      >
        <form key={editDept?.id ?? 'new'} onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Department Name</label>
            <input
              name="name"
              required
              className="input-field w-full"
              defaultValue={editDept?.name ?? ''}
              placeholder="e.g. Front Office, Housekeeping, F&B"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Description (optional)</label>
            <textarea
              name="description"
              className="input-field w-full min-h-[80px]"
              defaultValue={editDept?.description ?? ''}
              placeholder="Brief description of this department's role"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setIsModalOpen(false); setEditDept(null); }}>Cancel</Button>
            <Button variant="primary" type="submit">{editDept ? 'Update' : 'Create'} Department</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Department"
        message="Are you sure you want to delete this department? This action cannot be undone if managers or receptionists are assigned to it."
        confirmLabel="Delete"
      />
    </div>
  );
}
