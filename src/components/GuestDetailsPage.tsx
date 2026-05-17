'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { useApi } from '@/hooks/useApi';
import { Guest } from '@/types';

export default function GuestDetailsPage() {
  const params = useParams<{ id: string }>();
  const { data: guest, isLoading } = useApi<Guest>(`/api/guests/${params.id}`);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Guest Details" subtitle="Guest profile from the database." />

      {isLoading && <div className="card p-6 text-ink-600">Loading guest...</div>}

      {guest && (
        <div className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm text-ink-600">Name</div>
            <div className="text-lg font-medium text-ink-900">
              {guest.firstName} {guest.lastName}
            </div>
          </div>
          <div>
            <div className="text-sm text-ink-600">Status</div>
            <StatusBadge status={guest.status} />
          </div>
          <div>
            <div className="text-sm text-ink-600">Email</div>
            <div className="text-ink-900">{guest.email ?? '-'}</div>
          </div>
          <div>
            <div className="text-sm text-ink-600">Phone</div>
            <div className="text-ink-900">{guest.phone ?? '-'}</div>
          </div>
          <div>
            <div className="text-sm text-ink-600">Nationality</div>
            <div className="text-ink-900">{guest.nationality ?? '-'}</div>
          </div>
          <div>
            <div className="text-sm text-ink-600">Passport</div>
            <div className="text-ink-900">{guest.passport ?? '-'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
