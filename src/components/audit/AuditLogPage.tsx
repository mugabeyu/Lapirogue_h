'use client';

import { Fragment, useMemo, useState } from 'react';
import useSWR from 'swr';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

type AuditActor = { id: string; name: string | null; email: string | null; role: string | null };
type AuditEntry = {
  id: string;
  tableName: string;
  recordId: string | null;
  action: string;
  actor: AuditActor | null;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  createdAt: string;
};
type AuditResponse = {
  success: boolean;
  data: {
    entries: AuditEntry[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
};

async function fetchAuditLog(url: string) {
  const response = await fetch(url, { credentials: 'include' });
  return response.json() as Promise<AuditResponse>;
}

function actionBadgeClass(action: string) {
  switch (action) {
    case 'INSERT':
      return 'bg-[var(--color-success)]/15 text-[var(--color-success)]';
    case 'DELETE':
      return 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]';
    case 'BLOCK':
      return 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]';
    default:
      return 'bg-[var(--color-nav-active)]/15 text-[var(--color-text-primary)]';
  }
}

function formatDateTime(value: string) {
  const d = new Date(value);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [tableFilter, setTableFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (tableFilter) params.set('table', tableFilter);
    return `/api/audit-log?${params}`;
  }, [page, tableFilter]);

  const { data } = useSWR(url, fetchAuditLog);
  const entries = data?.data?.entries ?? [];
  const pagination = data?.data?.pagination;

  const tableOptions = [
    'reservations', 'guests', 'rooms', 'managers', 'receptionists', 'departments',
    'menu_items', 'hotel_services', 'hotel_service_categories', 'activities', 'notifications', 'messages',
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Audit Log" subtitle="A record of key actions taken across the system" />

      <div className="card p-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-[var(--color-text-secondary)]">Filter by table:</label>
        <select
          value={tableFilter}
          onChange={(e) => { setTableFilter(e.target.value); setPage(1); }}
          className="input-field w-auto"
        >
          <option value="">All tables</option>
          {tableOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm" aria-label="Audit log entries">
            <thead>
              <tr className="border-b border-border text-xs text-[var(--color-text-secondary)]">
                <th scope="col" className="px-5 py-3 font-medium">Date/Time</th>
                <th scope="col" className="border-l border-border px-5 py-3 font-medium">Table</th>
                <th scope="col" className="border-l border-border px-5 py-3 font-medium">Action</th>
                <th scope="col" className="border-l border-border px-5 py-3 font-medium">Actor</th>
                <th scope="col" className="border-l border-border px-5 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr className="border-b border-border">
                  <td colSpan={5} className="px-5 py-12 text-center text-[var(--color-text-secondary)]">No audit events recorded yet.</td>
                </tr>
              )}
              {entries.map((entry) => (
                <Fragment key={entry.id}>
                  <tr className="border-b border-border hover:bg-surface-secondary/50">
                    <td className="px-5 py-4 tabular-nums text-[var(--color-text-secondary)]">{formatDateTime(entry.createdAt)}</td>
                    <td className="border-l border-border px-5 py-4 font-medium text-[var(--color-text-primary)]">{entry.tableName}</td>
                    <td className="border-l border-border px-5 py-4">
                      <span className={`badge ${actionBadgeClass(entry.action)}`}>{entry.action}</span>
                    </td>
                    <td className="border-l border-border px-5 py-4 text-[var(--color-text-primary)]">
                      {entry.actor?.name || entry.actor?.email || 'System'}
                      {entry.actor?.role && <span className="ml-1 text-xs text-[var(--color-text-secondary)]">({entry.actor.role})</span>}
                    </td>
                    <td className="border-l border-border px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                        className="inline-flex items-center gap-1 text-[var(--color-link)] hover:underline"
                      >
                        {expandedId === entry.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {expandedId === entry.id ? 'Hide' : 'View'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr className="border-b border-border bg-surface-secondary/30">
                      <td colSpan={5} className="px-5 py-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">Before</p>
                            <pre className="max-h-48 overflow-auto rounded-md bg-surface p-3 text-xs text-[var(--color-text-secondary)]">
                              {entry.previousData ? JSON.stringify(entry.previousData, null, 2) : '—'}
                            </pre>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">After</p>
                            <pre className="max-h-48 overflow-auto rounded-md bg-surface p-3 text-xs text-[var(--color-text-secondary)]">
                              {entry.newData ? JSON.stringify(entry.newData, null, 2) : '—'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {pagination && (
          <div className="flex flex-col gap-3 border-t border-border px-6 py-4 text-sm text-[var(--color-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
            <p>Showing {entries.length} of {pagination.total} {pagination.total === 1 ? 'entry' : 'entries'}</p>
            <div className="flex items-center gap-4">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="disabled:opacity-40 hover:text-[var(--color-text-primary)]">Previous</button>
              <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40 hover:text-[var(--color-text-primary)]">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
