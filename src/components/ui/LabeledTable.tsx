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
    <div className={`table-compact ${className}`}>
      {summary ? (
        <p id={`${tableId}-summary`} className="sr-only">
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
      {footer ? <div className="pt-4 text-sm text-[var(--color-text-secondary)]">{footer}</div> : null}
    </div>
  );
}
