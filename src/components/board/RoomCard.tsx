'use client';

import { useState } from 'react';
import { Wrench, Sparkles, DoorClosed } from 'lucide-react';
import type { Room } from '@/types';

interface RoomCardProps {
  room: Room;
  isDragOver: boolean;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

const statusConfig: Record<string, { label: string; border: string; bg: string; icon: React.ReactNode }> = {
  AVAILABLE: {
    label: 'Available',
    border: 'border-success',
    bg: 'bg-success/5',
    icon: <Sparkles className="h-3.5 w-3.5 text-success" />,
  },
  CLEANING: {
    label: 'Cleaning',
    border: 'border-warning',
    bg: 'bg-warning/5',
    icon: <Sparkles className="h-3.5 w-3.5 text-warning" />,
  },
  OCCUPIED: {
    label: 'Occupied',
    border: 'border-primary',
    bg: 'bg-primary/5',
    icon: <DoorClosed className="h-3.5 w-3.5 text-primary" />,
  },
  MAINTENANCE: {
    label: 'Maintenance',
    border: 'border-danger',
    bg: 'bg-danger/5',
    icon: <Wrench className="h-3.5 w-3.5 text-danger" />,
  },
};

export function RoomCard({
  room,
  isDragOver,
  isDragging,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
}: RoomCardProps) {
  const [hover, setHover] = useState(false);
  const config = statusConfig[room.status] ?? statusConfig.AVAILABLE;
  const canDrop = room.status === 'AVAILABLE';

  function handleDragOver(e: React.DragEvent) {
    if (!canDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver(e);
  }

  function handleDragEnter(e: React.DragEvent) {
    if (!canDrop) return;
    e.preventDefault();
    onDragEnter(e);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!canDrop) return;
    onDragLeave(e);
  }

  function handleDrop(e: React.DragEvent) {
    if (!canDrop) return;
    e.preventDefault();
    onDrop(e);
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`relative flex flex-col rounded-xl border-2 p-3 transition-all duration-150 ${
        canDrop && (isDragOver || hover) ? 'scale-[1.02] shadow-lg' : ''
      } ${config.border} ${config.bg} ${
        canDrop && isDragging ? 'cursor-copy' : ''
      } ${!canDrop ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-lg font-bold text-[var(--color-text-primary)]">
          {room.roomNumber}
        </span>
        {config.icon}
      </div>

      <span className="mt-1 text-xs font-medium text-[var(--color-text-secondary)]">
        {room.type.replace('_', ' ')}
      </span>

      <span className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
        Rs {room.price.toLocaleString()}/night
      </span>

      <span className={`mt-2 inline-flex self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        room.status === 'AVAILABLE'
          ? 'bg-success/10 text-success'
          : room.status === 'CLEANING'
          ? 'bg-warning/10 text-warning'
          : room.status === 'OCCUPIED'
          ? 'bg-primary/10 text-primary'
          : 'bg-danger/10 text-danger'
      }`}>
        {config.label}
      </span>

      {canDrop && isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-primary/10 ring-2 ring-primary">
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-primary shadow-sm">
            Drop here
          </span>
        </div>
      )}
    </div>
  );
}
