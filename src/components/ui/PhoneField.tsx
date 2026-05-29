'use client';

import { useEffect, useState } from 'react';
import { formatInternationalPhoneDisplay, isInternationalPhoneDisplayValid } from '@/lib/phone';

type PhoneFieldProps = {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  className?: string;
  placeholder?: string;
};

export function PhoneField({
  name,
  defaultValue,
  required,
  className = 'input-field w-full',
  placeholder = '(+230) 1234 5678',
}: PhoneFieldProps) {
  const [value, setValue] = useState(() => formatInternationalPhoneDisplay(defaultValue ?? ''));

  useEffect(() => {
    setValue(formatInternationalPhoneDisplay(defaultValue ?? ''));
  }, [defaultValue]);

  return (
    <input
      name={name}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={value}
      onChange={(event) => setValue(formatInternationalPhoneDisplay(event.target.value))}
      onBlur={(event) => {
        if (event.target.value && !isInternationalPhoneDisplayValid(event.target.value)) {
          event.target.setCustomValidity('Use Mauritian format like (+230) 1234 5678');
        } else {
          event.target.setCustomValidity('');
        }
      }}
      pattern="^\(\+230\)(?: \d{4}){2}$"
      title="Use Mauritian format like (+230) 1234 5678"
      placeholder={placeholder}
      required={required}
      className={className}
    />
  );
}
