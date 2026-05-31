'use client';

import { useMemo, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { LabeledTable } from '@/components/ui/LabeledTable';
import { useApi } from '@/hooks/useApi';
import { formatTableValue, getTableValue, type TableColumnType } from '@/lib/table';

type Column = {
  key: string;
  label: string;
  type?: TableColumnType;
};

type DataTablePageProps = {
  title: string;
  subtitle?: string;
  endpoint: string;
  columns: Column[];
  searchPlaceholder?: string;
  tableCaption?: string;
  entityName?: string;
  emptyMessage?: string;
};

export default function DataTablePage({
  title,
  subtitle,
  endpoint,
  columns,
  searchPlaceholder = 'Search...',
  tableCaption,
  entityName,
  emptyMessage,
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
  const rowLabel = entityName ?? title.toLowerCase();
  const caption = tableCaption ?? `${title} listing`;
  const emptyText = emptyMessage ?? `No ${rowLabel} found.`;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="card">
        <div className="px-4 py-4 border-b border-border">
          <label htmlFor={`${title}-search`} className="sr-only">
            Search {rowLabel}
          </label>
          <div className="relative w-full sm:w-96">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              id={`${title}-search`}
              type="search"
              placeholder={searchPlaceholder}
              className="input-field pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <LabeledTable
            caption={caption}
            summary={`${title} — ${columns.map((column) => column.label).join(', ')}`}
            footer={
              isLoading
                ? `Loading ${rowLabel}...`
                : `Showing ${rows.length} ${rows.length === 1 ? rowLabel.replace(/s$/, '') : rowLabel}`
            }
          >
            <thead>
              <tr className="bg-surface-secondary text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                {columns.map((column) => (
                  <th key={column.key} scope="col" className="px-6 py-4 font-medium">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-[var(--color-text-secondary)]">
                    {emptyText}
                  </td>
                </tr>
              )}
              {rows.map((row, index) => (
                <tr key={String(row.id ?? index)} className="transition-colors hover:bg-surface-secondary">
                  {columns.map((column) => {
                    const value = getTableValue(row, column.key);
                    return (
                      <td key={column.key} className="px-6 py-4 text-sm text-[var(--color-text-primary)]">
                        {column.type === 'image' ? (
                          value ? (
                            <div className="flex items-center gap-3">
                              <img
                                src={String(value)}
                                alt={column.label}
                                className="h-12 w-12 rounded-xl border border-border object-cover"
                              />
                            </div>
                          ) : (
                            <span className="text-[var(--color-text-secondary)]">-</span>
                          )
                        ) : column.type === 'status' ? (
                          <StatusBadge status={String(value ?? '')} />
                        ) : (
                          formatTableValue(value, column.type)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </LabeledTable>
        </div>
      </div>
    </div>
  );
}
