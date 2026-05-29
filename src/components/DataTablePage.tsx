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
        <div className="border-b border-sand-200 bg-white p-4">
          <label htmlFor={`${title}-search`} className="sr-only">
            Search {rowLabel}
          </label>
          <div className="relative w-full sm:w-96">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
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
              <tr className="border-b border-sand-200 bg-sand-50 text-xs uppercase tracking-wider text-ink-600">
                {columns.map((column) => (
                  <th key={column.key} scope="col" className="px-6 py-4 font-medium">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-ink-500">
                    {emptyText}
                  </td>
                </tr>
              )}
              {rows.map((row, index) => (
                <tr key={String(row.id ?? index)} className="transition-colors hover:bg-sand-50/50">
                  {columns.map((column) => {
                    const value = getTableValue(row, column.key);
                    return (
                      <td key={column.key} className="px-6 py-4 text-sm text-ink-700">
                        {column.type === 'image' ? (
                          value ? (
                            <div className="flex items-center gap-3">
                              <img
                                src={String(value)}
                                alt={column.label}
                                className="h-12 w-12 rounded-xl border border-sand-200 object-cover"
                              />
                            </div>
                          ) : (
                            <span className="text-ink-400">-</span>
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
