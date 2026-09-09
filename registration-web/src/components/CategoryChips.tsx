import { useState } from 'react';

export interface CategoryOption {
  key: string;
  label: string;
}

interface CategoryChipsProps {
  options: CategoryOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  otherEntries: string[];
  onOtherEntriesChange: (next: string[]) => void;
}

/** Same multi-select chip + "+ Add New" custom-tag pattern as the mobile apps' WorkerProfileModal/BusinessProfileModal. */
export function CategoryChips({ options, selected, onChange, otherEntries, onOtherEntriesChange }: CategoryChipsProps) {
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherValue, setOtherValue] = useState('');

  const toggle = (key: string) => {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  };

  const ordered = [...options].sort((a, b) => Number(selected.includes(b.key)) - Number(selected.includes(a.key)));

  const commitOther = () => {
    const trimmed = otherValue.trim();
    if (trimmed) {
      const matched = options.find((o) => o.label.toLowerCase() === trimmed.toLowerCase());
      if (matched) {
        if (!selected.includes(matched.key)) onChange([...selected, matched.key]);
      } else {
        const existingIndex = otherEntries.findIndex((e) => e.toLowerCase() === trimmed.toLowerCase());
        if (existingIndex !== -1) {
          const existing = otherEntries[existingIndex];
          onOtherEntriesChange([existing, ...otherEntries.filter((_, i) => i !== existingIndex)]);
        } else {
          onOtherEntriesChange([...otherEntries, trimmed]);
        }
      }
    }
    setOtherValue('');
    setShowOtherInput(false);
  };

  const removeOther = (index: number) => {
    onOtherEntriesChange(otherEntries.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="chip-row">
        {ordered.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`chip ${selected.includes(option.key) ? 'chip--active' : ''}`}
            onClick={() => toggle(option.key)}
          >
            {option.label}
          </button>
        ))}
        {otherEntries.map((entry, index) => (
          <button
            key={`${entry}-${index}`}
            type="button"
            className="chip chip--active"
            onClick={() => removeOther(index)}
          >
            {entry} ✕
          </button>
        ))}
        <button type="button" className="chip" onClick={() => setShowOtherInput(true)}>
          + Add New
        </button>
      </div>

      {showOtherInput ? (
        <div className="field">
          <label>What's your category?</label>
          {/* Label sits above the row (not inside a per-input flex item beside the button) so
              the input and the "done" button — genuine siblings with no hidden label offset
              between them — center on each other exactly via alignItems:'center', rather than
              the previous alignItems:'flex-end' approximation. */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              style={{ flex: 1, width: 'auto', minWidth: 0 }}
              value={otherValue}
              onChange={(e) => setOtherValue(e.target.value)}
              onKeyDown={(e) => {
                // This chip picker now lives inside the page's own <form> (for its
                // Enter-to-submit behavior) — without preventDefault, Enter here would
                // both commit this tag *and* submit that outer form prematurely.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitOther();
                }
              }}
              autoFocus
            />
            <button
              type="button"
              className="button"
              style={{ width: 44, height: 44, padding: 0, flexShrink: 0 }}
              onClick={commitOther}
            >
              ✓
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
