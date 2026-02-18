'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

function formatWithCommas(value: string): string {
  // Remove everything except digits and decimal point
  const clean = value.replace(/[^\d.]/g, '');
  const parts = clean.split('.');
  // Format integer part with commas
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
}

function stripCommas(value: string): string {
  return value.replace(/,/g, '');
}

interface FormattedNumberInputProps {
  value: string | number;
  onChange: (rawValue: string) => void;
  placeholder?: string;
  className?: string;
  step?: string;
  required?: boolean;
  min?: string;
  max?: string;
  maxLength?: number;
  disabled?: boolean;
  id?: string;
}

export default function FormattedNumberInput({
  value,
  onChange,
  placeholder = '0.00',
  className = 'form-input',
  step,
  required,
  min,
  max,
  maxLength,
  disabled,
  id,
}: FormattedNumberInputProps) {
  const [displayValue, setDisplayValue] = useState(() =>
    value !== '' && value !== undefined && value !== null
      ? formatWithCommas(String(value))
      : ''
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display when value changes externally (e.g. form reset)
  useEffect(() => {
    const raw = String(value ?? '');
    const currentRaw = stripCommas(displayValue);
    if (raw !== currentRaw) {
      setDisplayValue(raw ? formatWithCommas(raw) : '');
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const cursorPos = input.selectionStart ?? 0;
      const oldLen = displayValue.length;

      const rawInput = e.target.value;
      // Allow only digits, decimal, and commas
      const cleaned = rawInput.replace(/[^\d.,]/g, '');
      const formatted = formatWithCommas(stripCommas(cleaned));
      const newLen = formatted.length;

      setDisplayValue(formatted);
      onChange(stripCommas(formatted));

      // Adjust cursor position after formatting
      requestAnimationFrame(() => {
        if (inputRef.current) {
          const diff = newLen - oldLen;
          const newPos = Math.max(0, cursorPos + diff);
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      });
    },
    [displayValue, onChange]
  );

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      required={required}
      disabled={disabled}
      maxLength={maxLength}
      id={id}
    />
  );
}
