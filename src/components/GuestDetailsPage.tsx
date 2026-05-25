'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft,
  BedDouble,
  Calendar,
  CircleDollarSign,
  Mail,
  Pencil,
  Phone,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  User,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EditGuestModal } from '@/components/modals/EditGuestModal';
import { useApi } from '@/hooks/useApi';
import { Guest, GuestProfileData, GuestStay } from '@/types';
import { toast } from 'sonner';

type TabId = 'overview' | 'bookings' | 'activities' | 'food' | 'payments';

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(value: number) {
  return `Rs ${value.toLocaleString()}`;
}

export default function GuestDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: profile, isLoading, mutate } = useApi<GuestProfileData>(
    `/api/guests/${params.id}/profile`,
  );

  async function handleDelete() {
    setIsDeleting(true);
    const response = await fetch(`/api/guests/${params.id}`, { method: 'DELETE' });
    setIsDeleting(false);

    if (!response.ok) {
      toast.error('Unable to delete guest');
      return;
    }

    toast.success('Guest deleted');
    router.push('/guests');
  }

  if (isLoading) {
    return (
      <LoadingState />
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <BackLink />
        <div className="rounded-[24px] border border-sand-200 bg-white p-8 text-center text-ink-600 shadow-sm">
          Guest not found.
        </div>
      </div>
    );
  }

  const { guest, currentStay, reservations, activityBookings, foodOrders, payments, stats } = profile;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <BackLink />

      <ProfileHeaderCard
        guest={guest}
        onEdit={() => setIsEditOpen(true)}
        onDelete={() => setIsDeleteOpen(true)}
      />

      <TabBar activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <OverviewTab guest={guest} currentStay={currentStay} stats={stats} />
      )}
      {activeTab === 'bookings' && (
        <TabList
          emptyMessage="No bookings found."
          rows={reservations.map((r) => ({
            id: r.id,
            primary: r.reservationId,
            secondary: `${r.roomNumber ?? '—'} · ${formatDate(r.checkIn)} — ${formatDate(r.checkOut)}`,
            meta: formatCurrency(r.totalAmount),
            status: r.status,
          }))}
        />
      )}
      {activeTab === 'activities' && (
        <TabList
          emptyMessage="No activity bookings found."
          rows={activityBookings.map((b) => ({
            id: b.id,
            primary: b.activity ?? 'Activity',
            secondary: formatDate(b.date),
            meta: `${b.participants} participant(s)`,
            status: b.status,
          }))}
        />
      )}
      {activeTab === 'food' && (
        <TabList
          emptyMessage="No food orders found."
          rows={foodOrders.map((o) => ({
            id: o.id,
            primary: o.orderId,
            secondary: formatDate(o.createdAt),
            meta: formatCurrency(o.total),
            status: o.status,
          }))}
        />
      )}
      {activeTab === 'payments' && (
        <TabList
          emptyMessage="No payments found."
          rows={payments.map((p) => ({
            id: p.id,
            primary: p.paymentId,
            secondary: `${p.method} · ${formatDate(p.createdAt)}`,
            meta: formatCurrency(p.amount),
            status: p.status,
          }))}
        />
      )}

      <EditGuestModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        guest={guest}
        currentStay={currentStay}
        onSaved={async () => {
          await mutate();
        }}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Guest"
        message={`Are you sure you want to permanently delete ${guest.firstName} ${guest.lastName}? This action cannot be undone.`}
        confirmLabel="Delete Guest"
        isLoading={isDeleting}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/guests" className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 hover:text-primary">
      <ArrowLeft className="h-4 w-4" />
      Back to Guests
    </Link>
  );
}

function ProfileHeaderCard({
  guest,
  onEdit,
  onDelete,
}: {
  guest: Guest;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-sand-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {guest.imagePath ? (
              <img src={guest.imagePath} alt="" className="h-full w-full rounded-2xl object-cover" />
            ) : (
              <User className="h-10 w-10" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl text-ink-900">
                {guest.firstName} {guest.lastName}
              </h1>
              <StatusBadge status={guest.status} />
              {guest.vip && (
                <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">VIP</span>
              )}
            </div>
            <p className="mt-2 text-sm text-ink-600">
              {guest.nationality && <span>{guest.nationality}</span>}
              {guest.passport && (
                <span>
                  {guest.nationality ? ' · ' : ''}
                  Passport: {guest.passport}
                </span>
              )}
              <span> · ID: {guest.guestId}</span>
            </p>
            <div className="mt-4 flex flex-col gap-2 text-sm text-ink-700">
              {guest.email && (
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-ink-400" />
                  {guest.email}
                </span>
              )}
              {guest.phone && (
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 text-ink-400" />
                  {guest.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit Profile
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-danger/30 px-4 py-2 font-medium text-danger transition-colors hover:bg-danger/5"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function TabBar({ activeTab, onChange }: { activeTab: TabId; onChange: (tab: TabId) => void }) {
  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'bookings', label: 'Bookings' },
    { id: 'activities', label: 'Activities' },
    { id: 'food', label: 'F&B Orders' },
    { id: 'payments', label: 'Payments' },
  ];

  return (
    <div className="border-b border-sand-200">
      <nav className="-mb-px flex gap-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-accent text-ink-900'
                : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function OverviewTab({
  guest,
  currentStay,
  stats,
}: {
  guest: Guest;
  currentStay: GuestStay | null;
  stats: GuestProfileData['stats'];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ProfileCard title="Current Stay" icon={<BedDouble className="h-5 w-5 text-primary" />}>
        {currentStay ? (
          <div className="space-y-2 text-sm">
            <p className="text-ink-900">
              <span className="text-ink-500">Room:</span>{' '}
              <span className="font-medium">
                {currentStay.roomNumber}
                {currentStay.roomType ? ` (${currentStay.roomType.replace('_', ' ')})` : ''}
              </span>
            </p>
            <p className="text-ink-700">
              <Calendar className="mr-1 inline h-4 w-4 text-ink-400" />
              {formatDate(currentStay.checkIn)} — {formatDate(currentStay.checkOut)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-500">No active stay on record.</p>
        )}
      </ProfileCard>

      <ProfileCard title="Quick Stats" icon={<Sparkles className="h-5 w-5 text-primary" />}>
        <ul className="space-y-3 text-sm">
          <StatRow icon={<BedDouble className="h-4 w-4" />} label="Total Stays" value={stats.totalStays} />
          <StatRow icon={<Sparkles className="h-4 w-4" />} label="Activities" value={stats.activities} />
          <StatRow icon={<UtensilsCrossed className="h-4 w-4" />} label="F&B Orders" value={stats.foodOrders} />
          <StatRow icon={<CircleDollarSign className="h-4 w-4" />} label="Total Spent" value={formatCurrency(stats.totalSpent)} />
        </ul>
      </ProfileCard>

      <ProfileCard title="Guest Notes & Preferences" className="lg:col-span-2">
        <p className="whitespace-pre-wrap text-sm text-ink-700">
          {guest.notes?.trim() ? guest.notes : 'No notes recorded for this guest.'}
        </p>
      </ProfileCard>
    </div>
  );
}

function ProfileCard({
  title,
  icon,
  children,
  className = '',
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[24px] border border-sand-200 bg-white p-6 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="font-display text-lg text-ink-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <li className="flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-2 text-ink-600">
        <span className="text-primary">{icon}</span>
        {label}
      </span>
      <span className="font-medium text-ink-900">{value}</span>
    </li>
  );
}

function TabList({
  rows,
  emptyMessage,
}: {
  rows: Array<{ id: string; primary: string; secondary: string; meta: string; status: string }>;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[24px] border border-sand-200 bg-white p-8 text-center text-sm text-ink-500 shadow-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-sand-200 bg-white shadow-sm">
      <ul className="divide-y divide-sand-200">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div>
              <p className="font-medium text-ink-900">{row.primary}</p>
              <p className="text-sm text-ink-500">{row.secondary}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-ink-700">{row.meta}</span>
              <StatusBadge status={row.status} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-[24px] border border-sand-200 bg-white p-8 text-ink-600 shadow-sm">
      Loading guest profile...
    </div>
  );
}
