import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  className,
  children,
  disabled,
  ...rest
}) => {
  const base = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variants: Record<Variant, string> = {
    primary: `bg-primary text-white px-4 py-2 rounded-[var(--radius-12)] hover:bg-primary-hover disabled:opacity-50 focus:ring-primary`,
    secondary: `bg-surface text-[var(--color-text-primary)] border border-border px-4 py-2 rounded-[var(--radius-12)] hover:bg-surface-secondary disabled:opacity-50 focus:ring-primary`,
    ghost: `bg-transparent text-[var(--color-text-primary)] px-3 py-2 rounded-[var(--radius-8)] hover:bg-surface-secondary disabled:opacity-50 focus:ring-primary`,
    danger: `bg-danger text-white px-4 py-2 rounded-[var(--radius-12)] hover:opacity-95 disabled:opacity-50 focus:ring-danger`,
  };

  return (
    <button
      className={cx(base, variants[variant], className)}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;
