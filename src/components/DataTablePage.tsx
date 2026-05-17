'use client';

import { useMemo, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { useApi } from '@/hooks/useApi';

type Column = {
  key: string;
  label: string;
  type?: 'text' | 'currency' | 'date' | 'status' | 'number';
};

type DataTablePageProps = {
  title: string;
  subtitle?: string;
  endpoint: string;
  columns: Column[];
  searchPlaceholder?: string;
};

function getValue(row: Record<string, unknown>, key: string) {
  return key.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[part];
  }, row);
}

function formatValue(value: unknown, type: Column['type']) {
  if (value === null || value === undefined || value === '') return '-';

  if (type === 'currency') {
    return `Rs ${Number(value).toLocaleString()}`;
  }

  if (type === 'date') {
    return new Date(String(value)).toLocaleDateString();
  }

  return String(value);
}

export default function DataTablePage({
  title,
  subtitle,
  endpoint,
  columns,
  searchPlaceholder = 'Search...',
}: DataTablePageProps) {
  const [search, setSearch] = useState('');
  const url = useMemo(() => {
    const [path, query = ''] = endpoint.split('?');
    const params = new URLSearchParams(query);
    if (search) params.set('search', search);
    return `${path}${params.toString() ? `?${params}` : ''}`;
  }, [endpoint, search]);
  const { data, isLoading } = useApi<Record<string, unknown>[]>(url);
  const rows = data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="card">
        <div className="p-4 border-b border-sand-200 bg-white">
          <div className="relative w-full sm:w-96">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
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
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sand-50 border-b border-sand-200 text-xs uppercase tracking-wider text-ink-600">
                {columns.map((column) => (
                  <th key={column.key} className="px-6 py-4 font-medium">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {rows.map((row, index) => (
                <tr key={String(row.id ?? index)} className="hover:bg-sand-50/50 transition-colors">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-sand-200 text-sm text-ink-600 bg-white">
          {isLoading ? 'Loading records...' : `${rows.length} records`}
        </div>
      </div>
    </div>
  );
}
