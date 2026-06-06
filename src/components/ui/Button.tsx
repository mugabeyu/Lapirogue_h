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
    primary: `bg-button-primary text-[#1F2937] px-4 py-2 rounded-xl hover:bg-button-primary-hover active:bg-button-primary-active disabled:opacity-50 focus:ring-button-primary`,
    secondary: `bg-surface text-[var(--color-text-primary)] border border-card-border px-4 py-2 rounded-xl hover:bg-card-border disabled:opacity-50 focus:ring-button-primary`,
    ghost: `bg-transparent text-[var(--color-text-primary)] px-3 py-2 rounded-xl hover:bg-card-border disabled:opacity-50 focus:ring-button-primary`,
    danger: `bg-danger text-white px-4 py-2 rounded-xl hover:opacity-95 disabled:opacity-50 focus:ring-danger`,
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
