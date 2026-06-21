import type { TableColumnType } from '@/lib/table';

type GuestNameCellSize = 'sm' | 'md' | 'lg';

type GuestNameCellProps = {
  name?: string | null;
  imageUrl?: string | null;
  fallback?: string | null;
  size?: GuestNameCellSize;
  className?: string;
};

const avatarSizes: Record<GuestNameCellSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-xs',
  lg: 'h-11 w-11 text-sm',
};

function getInitials(name?: string | null, fallback?: string | null) {
  const label = name?.trim() || fallback?.trim() || '';
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return initials || '?';
}

function isSafeImageUrl(url: string) {
  try {
    const parsed = new URL(url, 'https://local.example');
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

type GuestTableCellProps = {
  row: Record<string, unknown>;
  value: unknown;
  columnKey: string;
  columnType?: TableColumnType;
};

export function GuestTableCell({ row, value, columnKey, columnType }: GuestTableCellProps) {
  const isGuestColumn = columnType === 'guest' || columnKey === 'guest';
  const isNameColumn = columnKey === 'name';

  if (!isGuestColumn && !isNameColumn) return null;

  const imageUrl = String((row as Record<string, unknown>)[isGuestColumn ? 'guestImagePath' : 'imagePath'] ?? '') || undefined;

  return (
    <GuestNameCell
      name={String(value ?? '') || '-'}
      imageUrl={imageUrl && isSafeImageUrl(imageUrl) ? imageUrl : undefined}
    />
  );
}

export function GuestNameCell({
  name,
  imageUrl,
  fallback,
  size = 'md',
  className = '',
}: GuestNameCellProps) {
  const label = name?.trim() || fallback?.trim() || '-';
  const initials = getInitials(name, fallback);
  const safeImageUrl = imageUrl && isSafeImageUrl(imageUrl) ? imageUrl : undefined;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {safeImageUrl ? (
        <img
          src={safeImageUrl}
          alt={name || fallback || 'Guest'}
          className={`${avatarSizes[size]} shrink-0 rounded-full border border-border object-cover`}
        />
      ) : (
        <span className={`${avatarSizes[size]} flex shrink-0 items-center justify-center rounded-full border border-border bg-surface-secondary font-semibold text-[var(--color-text-secondary)]`}>
          {initials}
        </span>
      )}
      <span className="min-w-0 truncate font-medium text-[var(--color-text-primary)]">{label}</span>
    </div>
  );
}
