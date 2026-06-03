'use client';

import { useEffect, useMemo, useState } from 'react';
import { COUNTRY_OPTIONS, COUNTRY_LABELS } from '@/lib/countries';

type CountryComboboxFieldProps = {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  className?: string;
  placeholder?: string;
};

export function CountryComboboxField({
  name,
  defaultValue,
  required,
  className = 'input-field w-full',
  placeholder = 'Search and select a country',
}: CountryComboboxFieldProps) {
  const [query, setQuery] = useState(defaultValue ?? '');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(defaultValue ?? '');
  }, [defaultValue]);

  const selectedValue = query.trim();

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return COUNTRY_OPTIONS.slice(0, 12);
    return COUNTRY_OPTIONS.filter((country) => country.label.toLowerCase().includes(normalized)).slice(0, 12);
  }, [query]);

  function chooseCountry(country: string) {
    setQuery(country);
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
        className={className}
        autoComplete="off"
        required={required}
      />
      <input
        type="hidden"
        name={name}
        value={query}
      />
      {isOpen && matches.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-surface shadow-lg">
          {matches.map((country) => (
            <button
              key={country.code}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseCountry(country.label)}
              className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-surface-secondary hover:text-[var(--color-text-primary)]"
            >
              <span>{country.label}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">{country.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
