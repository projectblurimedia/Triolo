import { useEffect, useMemo, useRef, useState } from 'react';

export interface CategoryOption {
  key: string;
  label: string;
}

interface CategoryChipsProps {
  options: CategoryOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Categories typed by the visitor themselves (sent as "other" + description). */
  otherEntries: string[];
  onOtherEntriesChange: (next: string[]) => void;
  placeholder?: string;
}

/**
 * The same searchable multi-select as the apps' CategoryPicker: one field; click it and a panel
 * opens with a search box and the whole list A–Z (picked ones on top). Pick several, or add your
 * own words when nothing matches. Picks show as removable chips under the field.
 */
export function CategoryChips({
  options,
  selected,
  onChange,
  otherEntries,
  onOtherEntriesChange,
  placeholder = 'Choose from the list',
}: CategoryChipsProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Clicking anywhere else closes the panel.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    setTimeout(() => searchRef.current?.focus(), 0);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const sorted = useMemo(() => [...options].sort((a, b) => a.label.localeCompare(b.label)), [options]);
  const text = query.trim().toLowerCase();
  const matches = sorted.filter((option) => !text || option.label.toLowerCase().includes(text));
  const listed = [...matches.filter((o) => selected.includes(o.key)), ...matches.filter((o) => !selected.includes(o.key))];
  const typed = query.trim();
  const exists =
    options.some((o) => o.label.toLowerCase() === typed.toLowerCase()) ||
    otherEntries.some((entry) => entry.toLowerCase() === typed.toLowerCase());

  const toggle = (key: string) => onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  const addTyped = () => {
    const name = typed.replace(/[.:]/g, '').trim();
    if (name.length < 2 || exists) return;
    onOtherEntriesChange([...otherEntries, name]);
    setQuery('');
  };

  const picked = [...options.filter((o) => selected.includes(o.key)).map((o) => ({ key: o.key, label: o.label, custom: false })),
    ...otherEntries.map((entry) => ({ key: entry, label: entry, custom: true }))];
  const summary = picked.length === 0 ? placeholder : picked.length === 1 ? picked[0].label : `${picked.length} selected`;

  return (
    <div className="picker" ref={wrapRef}>
      <button
        type="button"
        className={`picker__field${picked.length ? ' picker__field--set' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="picker__summary">{summary}</span>
        <span className="picker__caret">{open ? '▴' : '▾'}</span>
      </button>

      {open ? (
        <div className="picker__panel">
          <input
            ref={searchRef}
            className="picker__search"
            value={query}
            placeholder="Search…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // The picker sits inside the page's <form>: Enter adds the typed category instead of submitting.
              if (e.key === 'Enter') {
                e.preventDefault();
                if (listed.length === 1) toggle(listed[0].key);
                else addTyped();
              }
              if (e.key === 'Escape') setOpen(false);
            }}
          />
          <div className="picker__list">
            {listed.map((option) => {
              const on = selected.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  className={`picker__row${on ? ' picker__row--on' : ''}`}
                  onClick={() => toggle(option.key)}
                >
                  <span className="picker__check">{on ? '✓' : ''}</span>
                  {option.label}
                </button>
              );
            })}
            {listed.length === 0 && !typed ? <div className="picker__empty">Nothing found</div> : null}
            {typed.length >= 2 && !exists ? (
              <button type="button" className="picker__row picker__row--add" onClick={addTyped}>
                <span className="picker__check">+</span>
                Add “{typed}”
              </button>
            ) : null}
          </div>
          <button type="button" className="button picker__done" onClick={() => setOpen(false)}>
            {picked.length ? `Done (${picked.length})` : 'Done'}
          </button>
        </div>
      ) : null}

      {picked.length > 0 ? (
        <div className="chip-row picker__chips">
          {picked.map((entry) => (
            <span key={`${entry.custom ? 'c' : 'k'}-${entry.key}`} className="chip chip--active">
              {entry.label}
              <button
                type="button"
                className="picker__remove"
                aria-label={`Remove ${entry.label}`}
                onClick={() =>
                  entry.custom
                    ? onOtherEntriesChange(otherEntries.filter((value) => value !== entry.key))
                    : onChange(selected.filter((key) => key !== entry.key))
                }
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
