import type { ReactNode } from 'react';

type LabeledTableProps = {
  caption: string;
  summary?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function LabeledTable({ caption, summary, children, footer, className = '' }: LabeledTableProps) {
  const tableId = caption.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={className}>
      {summary ? (
        <p id={`${tableId}-summary`} className="mb-3 px-1 text-sm font-medium text-ink-700">
          {summary}
        </p>
      ) : null}
      <table
        className="w-full border-collapse text-left"
        aria-label={caption}
        aria-describedby={summary ? `${tableId}-summary` : undefined}
      >
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
      {footer ? <div className="border-t border-sand-200 p-4 text-sm text-ink-600">{footer}</div> : null}
    </div>
  );
}
