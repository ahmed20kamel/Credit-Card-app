'use client';

import * as React from 'react';

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  /** When provided, options are labels and optionValues are values (e.g. ids). value/onChange use the value. */
  optionValues?: readonly string[];
  placeholder?: string;
  required?: boolean;
  id?: string;
  'aria-label'?: string;
  /** Extra options to show at top (e.g. current value when not in main list) */
  extraOptions?: string[];
  noMatchesText?: string;
};

export function SearchableSelect({
  value,
  onChange,
  options,
  optionValues,
  placeholder = 'Search or select...',
  required = false,
  id,
  'aria-label': ariaLabel,
  extraOptions = [],
  noMatchesText = 'No matches',
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlightIndex, setHighlightIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const hasValueMap = Boolean(optionValues && optionValues.length === options.length);

  const allOptions = React.useMemo(() => {
    if (hasValueMap) return [...options];
    const combined = [...extraOptions, ...options];
    return Array.from(new Set(combined));
  }, [hasValueMap, extraOptions, options]);

  const allValues = React.useMemo(() => (hasValueMap ? [...optionValues!] : null), [hasValueMap, optionValues]);

  const filteredOptions = React.useMemo(() => {
    if (!query.trim()) return allOptions;
    const q = query.toLowerCase().trim();
    return allOptions.filter((opt) => opt.toLowerCase().includes(q));
  }, [allOptions, query]);

  const valueToLabel = React.useCallback((v: string) => {
    if (!hasValueMap || !allValues) return v;
    const i = allValues.indexOf(v);
    return i >= 0 ? allOptions[i] : v;
  }, [hasValueMap, allValues, allOptions]);

  const displayValue = open ? query : (hasValueMap ? valueToLabel(value) : value) || '';

  const openDropdown = () => {
    setOpen(true);
    setQuery(hasValueMap ? valueToLabel(value) : value || '');
    setHighlightIndex(0);
  };

  const closeDropdown = () => {
    setOpen(false);
    setQuery('');
  };

  const selectOption = (option: string) => {
    if (hasValueMap && allValues) {
      const i = allOptions.indexOf(option);
      if (i >= 0 && allValues[i] !== undefined) {
        onChange(allValues[i]);
        closeDropdown();
        return;
      }
    }
    onChange(option);
    closeDropdown();
  };

  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    const highlighted = el.querySelector('[data-highlighted="true"]');
    highlighted?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, open]);

  React.useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((i) => (i < filteredOptions.length - 1 ? i + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((i) => (i > 0 ? i - 1 : filteredOptions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightIndex]) selectOption(filteredOptions[highlightIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        break;
      default:
        break;
    }
  };

  return (
    <div className="searchable-select" ref={containerRef}>
      <div className="searchable-select-input-wrap">
        <input
          type="text"
          id={id}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={open ? 'searchable-select-list' : undefined}
          role="combobox"
          required={required}
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlightIndex(0);
            if (!open) setOpen(true);
          }}
          onFocus={openDropdown}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="searchable-select-input"
          autoComplete="off"
        />
        <span className="searchable-select-chevron" aria-hidden>
          ▼
        </span>
      </div>
      {open && (
        <ul
          id="searchable-select-list"
          ref={listRef}
          role="listbox"
          className="searchable-select-list"
        >
          {filteredOptions.length === 0 ? (
            <li className="searchable-select-item searchable-select-empty" role="option">
              {noMatchesText}
            </li>
          ) : (
            filteredOptions.map((option, i) => (
              <li
                key={option}
                role="option"
                aria-selected={value === option}
                data-highlighted={i === highlightIndex ? 'true' : undefined}
                className={`searchable-select-item ${i === highlightIndex ? 'highlighted' : ''}`}
                onMouseEnter={() => setHighlightIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(option);
                }}
              >
                {option}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
