interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" aria-labelledby="page-title">
      <div>
        <h1 id="page-title" className="font-display text-2xl text-[var(--color-text-primary)]">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-[var(--color-text-secondary)] mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center">{action}</div>}
    </header>
  );
}