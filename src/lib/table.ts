export type TableColumnType = 'text' | 'currency' | 'date' | 'status' | 'number' | 'image';

export function getTableValue(row: Record<string, unknown>, key: string) {
  return key.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[part];
  }, row);
}

export function formatTableValue(value: unknown, type: TableColumnType | undefined) {
  if (value === null || value === undefined || value === '') return '-';

  if (type === 'image') {
    return String(value);
  }

  if (type === 'currency') {
    return `Rs ${Number(value).toLocaleString()}`;
  }

  if (type === 'date') {
    return new Date(String(value)).toLocaleDateString();
  }

  return String(value);
}