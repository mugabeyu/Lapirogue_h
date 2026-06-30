'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { useApi } from '@/hooks/useApi';
import { StatusBadge } from '@/components/StatusBadge';
import { ArrowLeft, Shield, Calendar, Building2, Mail, Phone, MapPin, UserCog } from 'lucide-react';
import type { Receptionist } from '@/types';

export default function ReceptionistDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: receptionists } = useApi<Receptionist[]>('/api/receptionists');
  const rec = (receptionists ?? []).find((r) => r.id === id);

  if (!rec) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="p-12 text-center text-[var(--color-text-secondary)]">Receptionist not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
        <ArrowLeft className="h-4 w-4" /> Back to Receptionists
      </button>

      <PageHeader title={`${rec.firstName} ${rec.lastName}`} subtitle={`Receptionist · ${rec.employeeCode}`} />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="card p-6 md:col-span-2 space-y-5">
          <h3 className="font-display text-lg text-[var(--color-text-primary)]">Profile Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                <Mail className="h-4 w-4" /> Email
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{rec.email}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                <Phone className="h-4 w-4" /> Phone
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{rec.phone || '-'}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                <Building2 className="h-4 w-4" /> Department
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{rec.departmentName || 'Unassigned'}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                <UserCog className="h-4 w-4" /> Reporting Manager
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{rec.managerName || 'Unassigned'}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                <Calendar className="h-4 w-4" /> Date of Joining
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {rec.dateOfJoining ? new Date(rec.dateOfJoining).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                <MapPin className="h-4 w-4" /> Home Address
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{rec.homeAddress || '-'}</p>
            </div>
          </div>
        </div>

        <div className="card p-6 space-y-5">
          <h3 className="font-display text-lg text-[var(--color-text-primary)]">Account</h3>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-[var(--color-text-secondary)] mb-1">Employee Code</div>
              <p className="font-mono text-sm font-medium text-[var(--color-primary)]">{rec.employeeCode}</p>
            </div>
            <div>
              <div className="text-sm text-[var(--color-text-secondary)] mb-1">Status</div>
              <StatusBadge status={rec.isActive ? 'ACTIVE' : 'INACTIVE'} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-1">
                <Shield className="h-4 w-4" /> Access Level
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Level 1 — Receptionist</p>
            </div>
            <div>
              <div className="text-sm text-[var(--color-text-secondary)] mb-1">Created</div>
              <p className="text-xs text-[var(--color-text-primary)]">
                {new Date(rec.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
