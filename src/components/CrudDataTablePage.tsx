"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Pencil, Plus, SearchIcon, Trash2, Unlock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { AddReservationModal } from "@/components/modals/AddReservationModal";
import { RoomModal } from "@/components/modals/RoomModal";
import { AddActivityModal } from "@/components/modals/AddActivityModal";
import { MenuItemModal } from "@/components/modals/MenuItemModal";
import { PaymentModal } from "@/components/modals/PaymentModal";

import { LabeledTable } from "@/components/ui/LabeledTable";
import { GuestTableCell } from "@/components/ui/GuestNameCell";
import {
  formatTableValue,
  getTableValue,
  type TableColumnType,
} from "@/lib/table";

export type CrudColumn = {
  key: string;
  label: string;
  type?: TableColumnType;
};

export type CrudEntityType =
  | "reservation"
  | "room"
  | "activity"
  | "menu-item"
  | "payment";

type CrudDataTablePageProps = {
  title: string;
  subtitle?: string;
  endpoint: string;
  columns: CrudColumn[];
  searchPlaceholder?: string;
  addLabel: string;
  entityType: CrudEntityType;
  addHref?: string;
  deleteEndpoint?: (id: string) => string;
  rowHrefBase?: string;
  disableEdit?: boolean;
  disableDelete?: boolean;
  blockable?: boolean;
  onBlockToggle?: (row: Record<string, unknown>) => Promise<void>;
  tableCaption?: string;
  entityName?: string;
  emptyMessage?: string;
  deleteDialogTitle?: string;
  deleteDialogMessage?: string;
  deleteConfirmLabel?: string;
  deleteSuccessMessage?: string;
  deleteErrorMessage?: string;
};

type EntityModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  editRow: Record<string, unknown> | null;
};

function EntityModal({
  entityType,
  ...props
}: EntityModalProps & { entityType: CrudEntityType }) {
  switch (entityType) {
    case "reservation":
      return <AddReservationModal {...props} />;
    case "room":
      return <RoomModal {...props} />;
    case "activity":
      return <AddActivityModal {...props} />;
    case "menu-item":
      return <MenuItemModal {...props} />;
    case "payment":
      return <PaymentModal {...props} />;
    default:
      return null;
  }
}

export default function CrudDataTablePage({
  title,
  subtitle,
  endpoint,
  columns,
  searchPlaceholder = "Search...",
  addLabel,
  entityType,
  addHref,
  deleteEndpoint,
  rowHrefBase,
  disableEdit = false,
  disableDelete = false,
  blockable = false,
  onBlockToggle,
  tableCaption,
  entityName,
  emptyMessage,
  deleteDialogTitle = "Delete Record",
  deleteDialogMessage = "Are you sure you want to delete this record? This action cannot be undone.",
  deleteConfirmLabel = "Delete",
  deleteSuccessMessage = "Record deleted",
  deleteErrorMessage = "Unable to delete record",
}: CrudDataTablePageProps) {
  const PAGE_SIZE = 15;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [deleteRow, setDeleteRow] = useState<Record<string, unknown> | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [blockRow, setBlockRow] = useState<Record<string, unknown> | null>(
    null,
  );
  const [isBlocking, setIsBlocking] = useState(false);
  const router = useRouter();

  const url = useMemo(() => {
    const [path, query = ""] = endpoint.split("?");
    const params = new URLSearchParams(query);
    if (search) params.set("search", search);
    return `${path}${params.toString() ? `?${params}` : ""}`;
  }, [endpoint, search]);

  const { data, mutate, error } = useApi<Record<string, unknown>[]>(url);
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

  async function handleDelete() {
    if (!deleteRow?.id) return;
    setIsDeleting(true);
    const deleteUrl = deleteEndpoint
      ? deleteEndpoint(String(deleteRow.id))
      : `${endpoint.split("?")[0]}?id=${deleteRow.id}`;
    const response = await fetch(deleteUrl, {
      method: "DELETE",
      credentials: "include",
    });
    setIsDeleting(false);

    if (!response.ok) {
      toast.error(deleteErrorMessage);
      return;
    }

    toast.success(deleteSuccessMessage);
    setDeleteRow(null);
    await mutate();
  }

  async function handleBlockToggle() {
    if (!blockRow?.id || !onBlockToggle) return;
    setIsBlocking(true);
    try {
      await onBlockToggle(blockRow);
      setBlockRow(null);
      await mutate();
    } catch {
      toast.error("Unable to update staff status");
    } finally {
      setIsBlocking(false);
    }
  }

  const closeModal = () => {
    setIsModalOpen(false);
    setEditRow(null);
  };

  const handleSaved = async () => {
    await mutate();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          addHref ? (
            <Link href={addHref} className="inline-flex">
              <Button variant="primary">
                <Plus className="h-4 w-4" />
                {addLabel}
              </Button>
            </Link>
          ) : (
            <Button
              variant="primary"
              onClick={() => {
                setEditRow(null);
                setIsModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {addLabel}
            </Button>
          )
        }
      />

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
            footer={`Showing ${rows.length === 0 ? 0 : start + 1}-${Math.min(start + PAGE_SIZE, rows.length)} of ${rows.length} ${rows.length === 1 ? rowLabel.replace(/s$/, "") : rowLabel}`}
          >
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                {columns.map((column, index) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`${index > 0 ? "border-l border-border" : ""} px-6 py-4 font-medium`}
                  >
                    {column.label}
                  </th>
                ))}
                {!disableEdit || !disableDelete ? (
                  <th
                    scope="col"
                    className="border-l border-border px-6 py-4 text-right font-medium"
                  >
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr className="border-b border-border">
                  <td
                    colSpan={
                      columns.length + (disableEdit && disableDelete ? 0 : 1)
                    }
                    className="px-6 py-12 text-center text-sm text-[var(--color-text-secondary)]"
                  >
                    {emptyText}
                  </td>
                </tr>
              )}
              {paginatedRows.map((row, index) => (
                <tr
                  key={String(row.id ?? index)}
                  className={`border-b border-border hover:bg-surface-secondary/50 ${rowHrefBase ? "cursor-pointer" : ""}`}
                  onClick={
                    rowHrefBase && row.id != null
                      ? () => router.push(`${rowHrefBase}/${String(row.id)}`)
                      : undefined
                  }
                >
                  {columns.map((column, idx) => {
                    const value = getTableValue(row, column.key);
                    return (
                      <td
                        key={column.key}
                        className={`${idx > 0 ? "border-l border-border" : ""} px-6 py-4 text-sm text-[var(--color-text-primary)]`}
                      >
                        {column.type === "guest" || column.key === "guest" ? (
                          <GuestTableCell
                            row={row}
                            value={value}
                            columnKey={column.key}
                            columnType={column.type}
                          />
                        ) : column.key === "name" ? (
                          <GuestTableCell
                            row={row}
                            value={value}
                            columnKey={column.key}
                            columnType={column.type}
                          />
                        ) : column.type === "image" ? (
                          value ? (
                            <img
                              src={String(value)}
                              alt={column.label}
                              className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
                            />
                          ) : (
                            <span className="text-[var(--color-text-secondary)]">
                              -
                            </span>
                          )
                        ) : column.type === "status" ? (
                          <StatusBadge status={String(value ?? "")} />
                        ) : (
                          formatTableValue(value, column.type)
                        )}
                      </td>
                    );
                  })}
                  {!disableEdit || !disableDelete ? (
                    <td className="border-l border-border px-6 py-4 text-right">
                      <div className="inline-flex gap-2">
                        {!disableEdit && (
                          <button
                            type="button"
                            className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-surface-secondary hover:text-[var(--color-primary)]"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditRow(row);
                              setIsModalOpen(true);
                            }}
                            aria-label={`Edit ${rowLabel}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {blockable && (
                          <button
                            type="button"
                            className={`rounded-lg p-2 ${
                              String(row.status ?? "") === "ACTIVE"
                                ? "text-[var(--color-text-secondary)] hover:bg-warning/10 hover:text-[var(--color-warning)]"
                                : "text-[var(--color-text-secondary)] hover:bg-success/10 hover:text-[var(--color-success)]"
                            }`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setBlockRow(row);
                            }}
                            aria-label={
                              String(row.status ?? "") === "ACTIVE"
                                ? `Block ${rowLabel}`
                                : `Unblock ${rowLabel}`
                            }
                          >
                            {String(row.status ?? "") === "ACTIVE" ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <Unlock className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        {!disableDelete && entityType !== "payment" && (
                          <button
                            type="button"
                            className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-danger/10 hover:text-[var(--color-danger)]"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteRow(row);
                            }}
                            aria-label={`Delete ${rowLabel}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </LabeledTable>
        </div>
        {rows.length > PAGE_SIZE ? (
          <div className="table-footer">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <EntityModal
        entityType={entityType}
        isOpen={isModalOpen}
        onClose={closeModal}
        onSaved={handleSaved}
        editRow={editRow}
      />

      {!disableDelete && entityType !== "payment" && (
        <ConfirmDialog
          isOpen={Boolean(deleteRow)}
          onClose={() => setDeleteRow(null)}
          onConfirm={handleDelete}
          title={deleteDialogTitle}
          message={deleteDialogMessage}
          confirmLabel={deleteConfirmLabel}
          isLoading={isDeleting}
        />
      )}

      {blockable && (
        <ConfirmDialog
          isOpen={Boolean(blockRow)}
          onClose={() => setBlockRow(null)}
          onConfirm={handleBlockToggle}
          title={
            String(blockRow?.status ?? "") === "ACTIVE"
              ? "Block Staff"
              : "Unblock Staff"
          }
          message={
            String(blockRow?.status ?? "") === "ACTIVE"
              ? `Are you sure you want to block ${String(blockRow?.name ?? "this staff member")}? They will not be able to log in until unblocked.`
              : `Are you sure you want to unblock ${String(blockRow?.name ?? "this staff member")}? They will regain access to the system.`
          }
          confirmLabel={
            String(blockRow?.status ?? "") === "ACTIVE" ? "Block" : "Unblock"
          }
          isLoading={isBlocking}
        />
      )}
    </div>
  );
}
