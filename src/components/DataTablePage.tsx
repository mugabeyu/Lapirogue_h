'use client';

import { useEffect, useMemo, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { LabeledTable } from '@/components/ui/LabeledTable';
import { GuestTableCell } from '@/components/ui/GuestNameCell';
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
  const PAGE_SIZE = 15;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const url = useMemo(() => {
    const [path, query = ''] = endpoint.split('?');
    const params = new URLSearchParams(query);
    if (search) params.set('search', search);
    return `${path}${params.toString() ? `?${params}` : ''}`;
  }, [endpoint, search]);
  const { data,  error } = useApi<Record<string, unknown>[]>(url);
  const rows = data ?? [];
  const apiError = error;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const paginatedRows = rows.slice(start, start + PAGE_SIZE);
  const rowLabel = entityName ?? title.toLowerCase();
  const caption = tableCaption ?? `${title} listing`;
  const emptyText = emptyMessage ?? `No ${rowLabel} found.`;

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="card">
        {apiError && (
          <p className="px-6 py-3 text-sm text-red-500">{apiError}</p>
        )}
        <div className="px-4 py-4">
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

        <div className="table-wrap">
          <LabeledTable
            caption={caption}
            footer={
              `Showing ${rows.length === 0 ? 0 : start + 1}-${Math.min(start + PAGE_SIZE, rows.length)} of ${rows.length} ${rows.length === 1 ? rowLabel.replace(/s$/, '') : rowLabel}`
            }
          >
            <thead>
              <tr className="border-b border-card-border text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                {columns.map((column, index) => (
                  <th key={column.key} scope="col" className={`${index > 0 ? 'border-l border-card-border' : ''} px-6 py-4 font-medium`}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              { rows.length === 0 && (
                <tr className="border-b border-card-border">
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-[var(--color-text-secondary)]">
                    {emptyText}
                  </td>
                </tr>
              )}
              {paginatedRows.map((row, index) => (
                <tr key={String(row.id ?? index)} className="border-b border-card-border transition-colors hover:bg-surface-secondary/50">
                  {columns.map((column, idx) => {
                    const value = getTableValue(row, column.key);
                    return (
                      <td key={column.key} className={`${idx > 0 ? 'border-l border-card-border' : ''} px-6 py-4 text-sm text-[var(--color-text-primary)]`}>
                        {column.type === 'guest' ? (
                          <GuestTableCell
                            row={row}
                            value={value}
                            columnKey={column.key}
                            columnType={column.type}
                          />
                        ) : column.type === 'image' ? (
                          value ? (
                            <img
                              src={String(value)}
                              alt={column.label}
                              className="h-10 w-10 shrink-0 rounded-full border border-card-border object-cover"
                            />
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
        {rows.length > PAGE_SIZE ? (
          <div className="table-footer">
            <span>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Previous
              </button>
              <button type="button" className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}