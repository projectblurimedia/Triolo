import { CSSProperties, KeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';

// Kept the same in admin-web, ads-web and registration-web (each site styles .dd-* itself).

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  /** A second, smaller line under the label. */
  description?: string;
  icon?: IconDefinition;
}

const PHONE = '(max-width: 600px)';

function usePhone(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  useEffect(() => {
    const query = window.matchMedia(PHONE);
    const update = () => setPhone(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return phone;
}

/**
 * Our own dropdown instead of the browser's <select>, whose list ignores the site's colours
 * (its options were unreadable in dark mode). A panel under the field on wide screens; on a
 * phone, a sheet from the bottom with big rows. Keyboard: arrows, Enter, Escape.
 */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  placeholder = 'Choose…',
  title,
  disabled,
}: {
  value: T | '';
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  /** The phone sheet's heading (usually the field's label). */
  title?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const phone = usePhone();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Where the panel sits (drawn on the page itself, so no card can clip it).
  const [place, setPlace] = useState<CSSProperties | null>(null);
  const id = useId();
  const selected = options.find((option) => option.value === value);

  const openList = () => {
    if (disabled) return;
    // The chosen one is highlighted; with nothing chosen, nothing is (arrows start at the top).
    setActive(options.findIndex((option) => option.value === value));
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const choose = (option: DropdownOption<T>) => {
    onChange(option.value);
    close();
  };

  // Under the field, or above it when there isn't room below; follows scrolling.
  useLayoutEffect(() => {
    if (!open || phone) return;
    const position = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const up = below < 240 && above > below;
      setPlace({
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(160, Math.min(320, (up ? above : below) - 6)),
        ...(up ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      });
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open, phone]);

  // A click anywhere else closes it (the phone sheet has its own backdrop).
  useEffect(() => {
    if (!open || phone) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!wrap.current?.contains(target) && !panel.current?.contains(target)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, phone]);

  // The page behind a phone sheet doesn't scroll.
  useEffect(() => {
    if (!open || !phone) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
  }, [open, phone]);

  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onKey = (event: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(options.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (options[active]) choose(options[active]);
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  const items = (
    <div
      ref={list}
      className="dd-list"
      role="listbox"
      id={id}
      tabIndex={-1}
      aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
      onKeyDown={onKey}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <div
            key={option.value}
            id={`${id}-${index}`}
            data-index={index}
            role="option"
            aria-selected={isSelected}
            className={`dd-option${isSelected ? ' selected' : ''}${index === active ? ' active' : ''}`}
            onMouseEnter={() => setActive(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(option)}
          >
            {option.icon ? (
              <span className="dd-option-icon">
                <FontAwesomeIcon icon={option.icon} />
              </span>
            ) : null}
            <span className="dd-option-text">
              <span className="dd-option-label">{option.label}</span>
              {option.description ? <span className="dd-option-desc">{option.description}</span> : null}
            </span>
            {isSelected ? <FontAwesomeIcon icon={faCheck} className="dd-check" /> : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={`dd${open ? ' open' : ''}`} ref={wrap}>
      <button
        type="button"
        ref={trigger}
        className="dd-trigger"
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKey}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
      >
        {selected?.icon ? (
          <span className="dd-trigger-icon">
            <FontAwesomeIcon icon={selected.icon} />
          </span>
        ) : null}
        <span className={`dd-value${selected ? '' : ' placeholder'}`}>{selected?.label ?? placeholder}</span>
        <FontAwesomeIcon icon={faChevronDown} className="dd-chevron" />
      </button>
      {open && !phone && place
        ? createPortal(
            <div className="dd-panel" ref={panel} style={place}>
              {items}
            </div>,
            document.body,
          )
        : null}
      {open && phone
        ? createPortal(
            <div className="dd-sheet-backdrop" onClick={() => close()}>
              <div className="dd-sheet" onClick={(event) => event.stopPropagation()}>
                <div className="dd-sheet-handle" />
                {title ? <div className="dd-sheet-title">{title}</div> : null}
                {items}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
