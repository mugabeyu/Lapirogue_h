'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { useApi } from '@/hooks/useApi';
import { StatusBadge } from '@/components/StatusBadge';
import { ArrowLeft, Shield, Calendar, Building2, Mail, Phone, MapPin } from 'lucide-react';
import type { Manager } from '@/types';

export default function ManagerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: managers } = useApi<Manager[]>('/api/managers');
  const manager = (managers ?? []).find((m) => m.id === id);

  if (!manager) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="p-12 text-center text-[var(--color-text-secondary)]">Manager not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
        <ArrowLeft className="h-4 w-4" /> Back to Managers
      </button>

      <PageHeader title={`${manager.firstName} ${manager.lastName}`} subtitle={`Manager · ${manager.managerId}`} />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="card p-6 md:col-span-2 space-y-5">
          <h3 className="font-display text-lg text-[var(--color-text-primary)]">Profile Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                <Mail className="h-4 w-4" /> Email
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{manager.email}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                <Phone className="h-4 w-4" /> Phone
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{manager.phone || '-'}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                <Building2 className="h-4 w-4" /> Department
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{manager.departmentName || 'Unassigned'}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                <Calendar className="h-4 w-4" /> Date of Joining
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {manager.dateOfJoining ? new Date(manager.dateOfJoining).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                <MapPin className="h-4 w-4" /> Home Address
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{manager.homeAddress || '-'}</p>
            </div>
          </div>
        </div>

        <div className="card p-6 space-y-5">
          <h3 className="font-display text-lg text-[var(--color-text-primary)]">Account</h3>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-[var(--color-text-secondary)] mb-1">Manager ID</div>
              <p className="font-mono text-sm font-medium text-[var(--color-primary)]">{manager.managerId}</p>
            </div>
            <div>
              <div className="text-sm text-[var(--color-text-secondary)] mb-1">Status</div>
              <StatusBadge status={manager.isActive ? 'ACTIVE' : 'INACTIVE'} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                <Shield className="h-4 w-4" /> Access Level
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Level 2 — Manager</p>
            </div>
            <div>
              <div className="text-sm text-[var(--color-text-secondary)] mb-1">Created</div>
              <p className="text-xs text-[var(--color-text-primary)]">
                {new Date(manager.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
