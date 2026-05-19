'use client';

import { useMemo, useState } from 'react';
import { Pencil, Plus, SearchIcon, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useApi } from '@/hooks/useApi';
import { toast } from 'sonner';
import { AddReservationModal } from '@/components/modals/AddReservationModal';
import { RoomModal } from '@/components/modals/RoomModal';
import { AddActivityModal } from '@/components/modals/AddActivityModal';
import { MenuItemModal } from '@/components/modals/MenuItemModal';
import { PaymentModal } from '@/components/modals/PaymentModal';

export type CrudColumn = {
  key: string;
  label: string;
  type?: 'text' | 'currency' | 'date' | 'status' | 'number';
};

export type CrudEntityType = 'reservation' | 'room' | 'activity' | 'menu-item' | 'payment';

type CrudDataTablePageProps = {
  title: string;
  subtitle?: string;
  endpoint: string;
  columns: CrudColumn[];
  searchPlaceholder?: string;
  addLabel: string;
  entityType: CrudEntityType;
  deleteEndpoint?: (id: string) => string;
};

function getValue(row: Record<string, unknown>, key: string) {
  return key.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[part];
  }, row);
}

function formatValue(value: unknown, type: CrudColumn['type']) {
  if (value === null || value === undefined || value === '') return '-';
  if (type === 'currency') return `Rs ${Number(value).toLocaleString()}`;
  if (type === 'date') return new Date(String(value)).toLocaleDateString();
  return String(value);
}

type EntityModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  editRow: Record<string, unknown> | null;
};

function EntityModal({ entityType, ...props }: EntityModalProps & { entityType: CrudEntityType }) {
  switch (entityType) {
    case 'reservation':
      return <AddReservationModal {...props} />;
    case 'room':
      return <RoomModal {...props} />;
    case 'activity':
      return <AddActivityModal {...props} />;
    case 'menu-item':
      return <MenuItemModal {...props} />;
    case 'payment':
      return <PaymentModal {...props} />;
    default:
      return null;
  }
}

export default function CrudDataTablePage({
  title,
  subtitle,
  endpoint,
  columns,
  searchPlaceholder = 'Search...',
  addLabel,
  entityType,
  deleteEndpoint,
}: CrudDataTablePageProps) {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [deleteRow, setDeleteRow] = useState<Record<string, unknown> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const url = useMemo(() => {
    const [path, query = ''] = endpoint.split('?');
    const params = new URLSearchParams(query);
    if (search) params.set('search', search);
    return `${path}${params.toString() ? `?${params}` : ''}`;
  }, [endpoint, search]);

  const { data, isLoading, mutate } = useApi<Record<string, unknown>[]>(url);
  const rows = data ?? [];

  async function handleDelete() {
    if (!deleteRow?.id) return;
    setIsDeleting(true);
    const deleteUrl = deleteEndpoint
      ? deleteEndpoint(String(deleteRow.id))
      : `${endpoint.split('?')[0]}?id=${deleteRow.id}`;
    const response = await fetch(deleteUrl, { method: 'DELETE' });
    setIsDeleting(false);

    if (!response.ok) {
      toast.error('Unable to delete record');
      return;
    }

    toast.success('Record deleted');
    setDeleteRow(null);
    await mutate();
  }

  const closeModal = () => {
    setIsModalOpen(false);
    setEditRow(null);
  };

  const handleSaved = async () => {
    await mutate();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => {
              setEditRow(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {addLabel}
          </button>
        }
      />

      <div className="overflow-hidden rounded-[24px] border border-sand-200 bg-white shadow-sm">
        <div className="border-b border-sand-200 p-4">
          <div className="relative w-full sm:w-96">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="input-field pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-sand-200 bg-sand-50 text-xs uppercase tracking-wider text-ink-600">
                {columns.map((column) => (
                  <th key={column.key} className="px-6 py-4 font-medium">
                    {column.label}
                  </th>
                ))}
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-sm text-ink-500">
                    No records found.
                  </td>
                </tr>
              )}
              {rows.map((row, index) => (
                <tr key={String(row.id ?? index)} className="hover:bg-sand-50/50">
                  {columns.map((column) => {
                    const value = getValue(row, column.key);
                    return (
                      <td key={column.key} className="px-6 py-4 text-sm text-ink-700">
                        {column.type === 'status' ? (
                          <StatusBadge status={String(value ?? '')} />
                        ) : (
                          formatValue(value, column.type)
                        )}
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-ink-500 hover:bg-sand-100 hover:text-primary"
                        onClick={() => {
                          setEditRow(row);
                          setIsModalOpen(true);
                        }}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-ink-500 hover:bg-danger/10 hover:text-danger"
                        onClick={() => setDeleteRow(row)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-sand-200 p-4 text-sm text-ink-600">
          {isLoading ? 'Loading records...' : `${rows.length} records`}
        </div>
      </div>

      <EntityModal
        entityType={entityType}
        isOpen={isModalOpen}
        onClose={closeModal}
        onSaved={handleSaved}
        editRow={editRow}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteRow)}
        onClose={() => setDeleteRow(null)}
        onConfirm={handleDelete}
        title="Delete Record"
        message="Are you sure you want to delete this record? This action cannot be undone."
        isLoading={isDeleting}
      />
    </div>
  );
}
