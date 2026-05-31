import React from 'react';

export type StatusKey =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'checked-in'
  | 'checked-out'
  | 'active'
  | 'inactive'
  | 'paid'
  | 'pending'
  | 'cancelled';

const map: Record<StatusKey, { bg: string; text: string }> = {
  available: { bg: 'bg-[#ECFDF5]', text: 'text-[#065F46]' },
  occupied: { bg: 'bg-[#FEF3F2]', text: 'text-[#7F1D1D]' },
  reserved: { bg: 'bg-[#FFFBEB]', text: 'text-[#92400E]' },
  'checked-in': { bg: 'bg-[#ECFDF5]', text: 'text-[#065F46]' },
  'checked-out': { bg: 'bg-[#F3F4F6]', text: 'text-[#374151]' },
  active: { bg: 'bg-[#ECFDF5]', text: 'text-[#065F46]' },
  inactive: { bg: 'bg-[#F3F4F6]', text: 'text-[#374151]' },
  paid: { bg: 'bg-[#ECFDF5]', text: 'text-[#065F46]' },
  pending: { bg: 'bg-[#FFFBEB]', text: 'text-[#92400E]' },
  cancelled: { bg: 'bg-[#FEF2F2]', text: 'text-[#991B1B]' },
};

export const StatusBadge: React.FC<{ status: StatusKey; className?: string }> = ({ status, className }) => {
  const styles = map[status] ?? map['inactive'];
  return (
    <span className={`${styles.bg} ${styles.text} inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${className ?? ''}`}>
      {status.replace(/-/g, ' ')}
    </span>
  );
};

export default StatusBadge;
