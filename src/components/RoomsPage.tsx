'use client';

import { useMemo, useState } from 'react';
import { Grid3X3, LayoutList, Plus, SearchIcon, BedDouble, Users, Pen, Trash2 } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RoomModal } from '@/components/modals/RoomModal';
import { Room } from '@/types';

type ViewMode = 'grid' | 'list';

function roomImage(room: Room) {
  return room.imagePath ?? room.imagePaths?.[0] ?? null;
}

function roomTypeLabel(type: Room['type']) {
  return type
    .toLowerCase()
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function RoomsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [deleteRow, setDeleteRow] = useState<Record<string, unknown> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const url = useMemo(() => '/api/rooms?limit=200', []);
  const { data, isLoading, mutate } = useApi<Room[]>(url);
  const rows = data ?? [];

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((room) => {
      const matchesSearch = !query || [room.roomNumber, room.type, room.floor ?? '', room.description ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query);
      const matchesType = !type || room.type === type;
      const matchesStatus = !status || room.status === status;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [rows, search, status, type]);

  async function handleDelete() {
    if (!deleteRow?.id) return;
    setIsDeleting(true);
    const response = await fetch(`/api/rooms?id=${deleteRow.id}`, { method: 'DELETE' });
    setIsDeleting(false);

    if (!response.ok) return;

    setDeleteRow(null);
    await mutate();
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Rooms"
        subtitle="Manage room inventory, status, and pricing."
        action={(
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => {
              setEditRow(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Room
          </button>
        )}
      />

      <div className="overflow-hidden rounded-[24px] border border-sand-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-sand-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative w-full min-w-[220px] max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search rooms..."
                className="input-field w-full pl-10"
              />
            </div>

            <select value={type} onChange={(event) => setType(event.target.value)} className="input-field w-full sm:w-44">
              <option value="">All Types</option>
              <option value="STANDARD">Standard</option>
              <option value="DELUXE">Deluxe</option>
              <option value="SUITE">Suite</option>
              <option value="VILLA">Villa</option>
            </select>

            <select value={status} onChange={(event) => setStatus(event.target.value)} className="input-field w-full sm:w-44">
              <option value="">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="CLEANING">Cleaning</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
          </div>

          <div className="inline-flex rounded-2xl border border-sand-200 bg-sand-50 p-1">
            <button
              type="button"
              onClick={() => setView('grid')}
              className={`rounded-xl p-2 ${view === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-ink-500'}`}
              aria-label="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`rounded-xl p-2 ${view === 'list' ? 'bg-white text-primary shadow-sm' : 'text-ink-500'}`}
              aria-label="List view"
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>

        {view === 'grid' ? (
          <div className="grid gap-5 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {!isLoading && filteredRows.length === 0 ? (
              <div className="col-span-full rounded-[20px] border border-dashed border-sand-300 p-10 text-center text-sm text-ink-500">
                No rooms found.
              </div>
            ) : null}
            {filteredRows.map((room) => {
              const image = roomImage(room);
              return (
                <article
                  key={room.id}
                  className="group overflow-hidden rounded-[20px] border border-sand-200 bg-white shadow-sm transition-transform hover:-translate-y-1 hover:shadow-lg"
                >
                  <button type="button" className="block w-full text-left" onClick={() => {
                    setEditRow(room as unknown as Record<string, unknown>);
                    setIsModalOpen(true);
                  }}>
                    <div className="relative aspect-[4/3] overflow-hidden bg-sand-100">
                      {image ? (
                        <img src={image} alt={`Room ${room.roomNumber}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sand-100 to-sand-200 text-ink-400">
                          <BedDouble className="h-10 w-10" />
                        </div>
                      )}
                      <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-700">
                        {room.status}
                      </div>
                      <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-sm font-semibold text-white">
                        Rs {Number(room.price).toLocaleString()} / night
                      </div>
                    </div>

                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-display text-xl text-ink-900">Room {room.roomNumber}</h3>
                          <p className="text-sm text-ink-600">{roomTypeLabel(room.type)}</p>
                        </div>
                        <p className="text-sm text-ink-500">{room.floor ?? '-'}</p>
                      </div>

                      <div className="flex items-center gap-4 border-t border-sand-200 pt-3 text-sm text-ink-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-4 w-4" /> Up to {room.capacity}
                        </span>
                        <span className="inline-flex items-center gap-1.5">{room.amenities.length} amenities</span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center justify-between border-t border-sand-200 px-4 py-3">
                    <StatusBadge status={room.status} />
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-ink-500 hover:bg-sand-100 hover:text-primary"
                        onClick={() => {
                          setEditRow(room as unknown as Record<string, unknown>);
                          setIsModalOpen(true);
                        }}
                        aria-label={`Edit room ${room.roomNumber}`}
                      >
                        <Pen className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-ink-500 hover:bg-danger/10 hover:text-danger"
                        onClick={() => setDeleteRow(room as unknown as Record<string, unknown>)}
                        aria-label={`Delete room ${room.roomNumber}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-sand-200 bg-sand-50 text-xs uppercase tracking-wider text-ink-600">
                  <th className="px-6 py-4 font-medium">Photo</th>
                  <th className="px-6 py-4 font-medium">Room</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Floor</th>
                  <th className="px-6 py-4 font-medium">Capacity</th>
                  <th className="px-6 py-4 font-medium">Price/Night</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {!isLoading && filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-ink-500">
                      No rooms found.
                    </td>
                  </tr>
                ) : null}
                {filteredRows.map((room) => {
                  const image = roomImage(room);
                  return (
                    <tr key={room.id} className="hover:bg-sand-50/50">
                      <td className="px-6 py-4">
                        {image ? (
                          <img src={image} alt={`Room ${room.roomNumber}`} className="h-12 w-12 rounded-xl border border-sand-200 object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sand-200 bg-sand-50 text-ink-400">
                            <BedDouble className="h-4 w-4" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-ink-900">{room.roomNumber}</td>
                      <td className="px-6 py-4 text-ink-700">{roomTypeLabel(room.type)}</td>
                      <td className="px-6 py-4 text-ink-700">{room.floor ?? '-'}</td>
                      <td className="px-6 py-4 text-ink-700">{room.capacity}</td>
                      <td className="px-6 py-4 text-ink-700">Rs {Number(room.price).toLocaleString()}</td>
                      <td className="px-6 py-4"><StatusBadge status={room.status} /></td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-ink-500 hover:bg-sand-100 hover:text-primary"
                            onClick={() => {
                              setEditRow(room as unknown as Record<string, unknown>);
                              setIsModalOpen(true);
                            }}
                            aria-label={`Edit room ${room.roomNumber}`}
                          >
                            <Pen className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-ink-500 hover:bg-danger/10 hover:text-danger"
                            onClick={() => setDeleteRow(room as unknown as Record<string, unknown>)}
                            aria-label={`Delete room ${room.roomNumber}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RoomModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditRow(null);
        }}
        onSaved={async () => {
          await mutate();
        }}
        editRow={editRow}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteRow)}
        title="Delete room"
        message={`Delete room ${String(deleteRow?.roomNumber ?? '')}? This cannot be undone.`}
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        onConfirm={handleDelete}
        onClose={() => setDeleteRow(null)}
      />
    </div>
  );
}