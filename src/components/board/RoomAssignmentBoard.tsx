'use client';

import { useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ArrowRight, LogIn } from 'lucide-react';
import { ArrivalsPanel } from './ArrivalsPanel';
import { RoomGrid } from './RoomGrid';
import { Modal } from '@/components/Modal';
import Button from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
import type { Reservation, Room } from '@/types';

interface DragData {
  reservationId: string;
  guestId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalAmount: number;
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function tomorrow(dateStr: string) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function daysBetween(a: string, b: string) {
  const start = new Date(a);
  const end = new Date(b);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export function RoomAssignmentBoard() {
  const today = useMemo(getToday, []);

  const {
    data: reservationsData,
    isLoading: loadingReservations,
    mutate: mutateReservations,
  } = useApi<Reservation[]>('/api/reservations?status=CONFIRMED');

  const {
    data: roomsData,
    isLoading: loadingRooms,
    mutate: mutateRooms,
  } = useApi<Room[]>('/api/rooms?limit=200');

  const [isDragging, setIsDragging] = useState(false);
  const [dragOverRoomId, setDragOverRoomId] = useState<string | null>(null);
  const [dragData, setDragData] = useState<DragData | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [targetRoom, setTargetRoom] = useState<Room | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const arrivals = useMemo(() => {
    if (!reservationsData) return [];
    return reservationsData.filter((r) => {
      const checkInDate = r.checkIn ? r.checkIn.split('T')[0] : '';
      return checkInDate === today;
    });
  }, [reservationsData, today]);

  const rooms = useMemo(() => {
    if (!roomsData) return [];
    return roomsData;
  }, [roomsData]);

  const roomsMap = useMemo(() => {
    const map = new Map<string, Room>();
    for (const r of rooms) {
      map.set(r.id, r);
    }
    return map;
  }, [rooms]);

  const handleDragStart = useCallback((e: React.DragEvent, arrival: Reservation) => {
    const guest = arrival.guest;
    if (!guest) {
      toast.error('Guest information is missing for this reservation.');
      e.preventDefault();
      return;
    }
    const data: DragData = {
      reservationId: arrival.id,
      guestId: guest.id,
      guestName: `${guest.firstName} ${guest.lastName}`,
      checkIn: arrival.checkIn || today,
      checkOut: arrival.checkOut || tomorrow(today),
      adults: arrival.adults || 1,
      children: arrival.children || 0,
      totalAmount: arrival.totalAmount || 0,
    };
    setDragData(data);
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';
  }, [today]);

  const handleDragEnd = useCallback((_e: React.DragEvent) => {
    setIsDragging(false);
    setDragOverRoomId(null);
  }, []);

  const handleRoomDragOver = useCallback((e: React.DragEvent, _roomId: string) => {
    e.preventDefault();
  }, []);

  const handleRoomDragEnter = useCallback((e: React.DragEvent, roomId: string) => {
    e.preventDefault();
    setDragOverRoomId(roomId);
  }, []);

  const handleRoomDragLeave = useCallback((_e: React.DragEvent) => {
    setDragOverRoomId(null);
  }, []);

  const handleRoomDrop = useCallback((e: React.DragEvent, roomId: string) => {
    e.preventDefault();
    setDragOverRoomId(null);
    setIsDragging(false);

    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;

    let parsed: DragData;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const room = roomsMap.get(roomId);
    if (!room) return;

    if (room.status !== 'AVAILABLE') {
      toast.error(`Room ${room.roomNumber} is not available.`);
      return;
    }

    setDragData(parsed);
    setTargetRoom(room);
    setShowConfirm(true);
  }, [roomsMap]);

  async function handleConfirm() {
    if (!dragData || !targetRoom) return;

    setIsSaving(true);
    const total = dragData.totalAmount > 0
      ? dragData.totalAmount
      : targetRoom.price * daysBetween(dragData.checkIn, dragData.checkOut);

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: dragData.guestId,
          roomId: targetRoom.id,
          checkIn: dragData.checkIn,
          checkOut: dragData.checkOut,
          adults: dragData.adults,
          children: dragData.children,
          totalAmount: total,
          status: 'CHECKED_IN',
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        toast.error(body.error ?? 'Failed to assign room');
        return;
      }

      toast.success(`${dragData.guestName} checked into Room ${targetRoom.roomNumber}`);
      setShowConfirm(false);
      setDragData(null);
      setTargetRoom(null);
      await Promise.all([mutateReservations(), mutateRooms()]);
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setShowConfirm(false);
    setDragData(null);
    setTargetRoom(null);
  }

  const totalRooms = rooms.length;
  const availableRooms = rooms.filter((r) => r.status === 'AVAILABLE').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Rooms" value={totalRooms} />
        <StatCard label="Available" value={availableRooms} variant="success" />
        <StatCard label="Arrivals Today" value={arrivals.length} variant="primary" />
        <StatCard label="Occupied" value={rooms.filter((r) => r.status === 'OCCUPIED').length} variant="primary" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        {/* Left: Arrivals Panel */}
        <div className="order-2 xl:order-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-[var(--color-text-primary)]">
              Arrivals Today
            </h2>
            <button
              onClick={() => { mutateReservations(); mutateRooms(); }}
              className="rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-surface-secondary"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <ArrivalsPanel
            arrivals={arrivals}
            isLoading={loadingReservations}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        </div>

        {/* Right: Room Grid */}
        <div className="order-1 xl:order-2 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-[var(--color-text-primary)]">
              Room Board
            </h2>
            <div className="flex items-center gap-3">
              {isDragging && (
                <span className="text-xs font-medium text-primary animate-pulse">
                  Drop on an available room
                </span>
              )}
              <button
                onClick={() => { mutateReservations(); mutateRooms(); }}
                className="rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-surface-secondary"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
          {loadingRooms ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-secondary)]" />
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <RoomGrid
                rooms={rooms}
                isDragging={isDragging}
                dragOverRoomId={dragOverRoomId}
                onDragOver={handleRoomDragOver}
                onDragEnter={handleRoomDragEnter}
                onDragLeave={handleRoomDragLeave}
                onDrop={handleRoomDrop}
              />
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirm}
        onClose={handleCancel}
        title="Confirm Room Assignment"
        subtitle="Review the check-in details below."
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirm} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <LogIn className="h-4 w-4 mr-2" />
              )}
              {isSaving ? 'Checking in...' : 'Check In'}
            </Button>
          </div>
        }
      >
        {dragData && targetRoom && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Guest Details */}
              <div className="rounded-xl border border-border bg-surface-secondary/30 p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Guest
                </h4>
                <p className="font-medium text-[var(--color-text-primary)]">
                  {dragData.guestName}
                </p>
                <div className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
                  <p>Adults: {dragData.adults}</p>
                  <p>Children: {dragData.children}</p>
                </div>
              </div>

              {/* Room Details */}
              <div className="rounded-xl border border-border bg-surface-secondary/30 p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Room
                </h4>
                <p className="font-medium text-[var(--color-text-primary)]">
                  Room {targetRoom.roomNumber}
                </p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {targetRoom.type.replace('_', ' ')}
                </p>
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                  Rs {targetRoom.price.toLocaleString()} / night
                </p>
              </div>
            </div>

            {/* Stay Details */}
            <div className="rounded-xl border border-border bg-surface-secondary/30 p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Stay
              </h4>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-[var(--color-text-secondary)]">Check-in</span>
                  <p className="font-medium text-[var(--color-text-primary)]">
                    {new Date(dragData.checkIn).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--color-text-secondary)]">Check-out</span>
                  <p className="font-medium text-[var(--color-text-primary)]">
                    {new Date(dragData.checkOut).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--color-text-secondary)]">Total</span>
                  <p className="font-medium text-[var(--color-text-primary)]">
                    Rs{' '}
                    {(
                      dragData.totalAmount > 0
                        ? dragData.totalAmount
                        : targetRoom.price * daysBetween(dragData.checkIn, dragData.checkOut)
                    ).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-success/5 px-4 py-3 text-sm text-success">
              <ArrowRight className="h-4 w-4 shrink-0" />
              <span>
                This will check <strong>{dragData.guestName}</strong> into{' '}
                <strong>Room {targetRoom.roomNumber}</strong> with status{' '}
                <strong>CHECKED_IN</strong>.
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: number;
  variant?: 'default' | 'success' | 'primary';
}) {
  const valueColor = {
    default: 'text-[var(--color-text-primary)]',
    success: 'text-success',
    primary: 'text-primary',
  }[variant];

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}
