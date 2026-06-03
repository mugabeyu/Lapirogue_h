'use client';

type FormSectionProps = {
  children: React.ReactNode;
  columns?: 1 | 2;
  className?: string;
};

export function FormSection({ children, columns = 2, className = 'gap-4' }: FormSectionProps) {
  const gridClass = columns === 2 ? 'grid grid-cols-2' : '';
  return <div className={`${gridClass} ${className}`}>{children}</div>;
}

type FormFieldProps = {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
};

export function FormField({ label, name, type = 'text', defaultValue = '', required, disabled, children }: FormFieldProps) {
  if (children) {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{label}</label>
        {children}
      </div>
    );
  }
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        className="input-field w-full"
      />
    </div>
  );
}