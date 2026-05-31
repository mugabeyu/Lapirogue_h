import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className, ...rest }) => {
  return (
    <div
      className={`bg-surface border border-border rounded-[var(--radius-12)] shadow-[var(--shadow-small)] ${className ?? ''}`}
      {...rest}
    >
      <div className="p-card">{children}</div>
    </div>
  );
};

export default Card;
