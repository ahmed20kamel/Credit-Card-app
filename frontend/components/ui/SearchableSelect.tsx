'use client';

import * as React from 'react';

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  /** When provided, options are labels and optionValues are values. value/onChange use the value. */
  optionValues?: readonly string[];
  placeholder?: string;
  required?: boolean;
  id?: string;
  'aria-label'?: string;
  /** Extra options to show at top (e.g. current value when not in main list) */
  extraOptions?: string[];
  noMatchesText?: string;
  /** Allow typing a custom value not in the list */
  creatable?: boolean;
  /** Label shown on the "add new" row, e.g. "Add" */
  createText?: string;
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
  creatable = false,
  createText = 'Add',
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

  // Whether to show the "create" row
  const canCreate = React.useMemo(() => {
    if (!creatable || !query.trim()) return false;
    const q = query.toLowerCase().trim();
    return !allOptions.some((o) => o.toLowerCase() === q);
  }, [creatable, query, allOptions]);

  const totalItems = filteredOptions.length + (canCreate ? 1 : 0);
  const CREATE_INDEX = filteredOptions.length; // virtual index of the create row

  const valueToLabel = React.useCallback((v: string) => {
    if (!hasValueMap || !allValues) return v;
    const i = allValues.indexOf(v);
    return i >= 0 ? allOptions[i] : v;
  }, [hasValueMap, allValues, allOptions]);

  const displayValue = open ? query : (hasValueMap ? valueToLabel(value) : value) || '';

  const openDropdown = () => {
    setOpen(true);
    setQuery('');
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

  const handleCreate = () => {
    const val = query.trim();
    if (!val) return;
    onChange(val);
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
        setHighlightIndex((i) => (i < totalItems - 1 ? i + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((i) => (i > 0 ? i - 1 : totalItems - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (canCreate && highlightIndex === CREATE_INDEX) {
          handleCreate();
        } else if (filteredOptions[highlightIndex]) {
          selectOption(filteredOptions[highlightIndex]);
        }
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
          {filteredOptions.length === 0 && !canCreate ? (
            <li className="searchable-select-item searchable-select-empty" role="option" aria-selected={false}>
              {noMatchesText}
            </li>
          ) : (
            <>
              {filteredOptions.map((option, i) => (
                <li
                  key={option}
                  role="option"
                  aria-selected={hasValueMap && allValues ? value === allValues[allOptions.indexOf(option)] : value === option}
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
              ))}
              {canCreate && (
                <li
                  role="option"
                  aria-selected={false}
                  data-highlighted={highlightIndex === CREATE_INDEX ? 'true' : undefined}
                  className={`searchable-select-item searchable-select-create ${highlightIndex === CREATE_INDEX ? 'highlighted' : ''}`}
                  onMouseEnter={() => setHighlightIndex(CREATE_INDEX)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleCreate();
                  }}
                >
                  <span className="searchable-select-create-icon">+</span>
                  {createText} &ldquo;{query.trim()}&rdquo;
                </li>
              )}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
