import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowLeft,
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faMagnifyingGlass,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { initials, Tone } from '@/utils/format';
import { useToastStore } from '@/state/toastStore';
import { getErrorMessage } from '@/services/errorMessages';

export function Badge({ tone, children, dot = true }: { tone: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`badge tone-${tone}`}>
      {dot ? <span className="dot" /> : null}
      {children}
    </span>
  );
}

export function Avatar({
  name,
  photo,
  square,
  gradient,
}: {
  name?: string | null;
  photo?: string | null;
  square?: boolean;
  gradient?: string;
}) {
  return (
    <span className={`avatar${square ? ' square' : ''}`} style={gradient ? { background: gradient } : undefined}>
      {photo ? <img src={photo} alt="" loading="lazy" /> : initials(name)}
    </span>
  );
}

export function IconSquare({ icon, gradient, size = 34 }: { icon: IconDefinition; gradient: string; size?: number }) {
  return (
    <span className="nav-icon" style={{ background: gradient, width: size, height: size, borderRadius: size * 0.32 }}>
      <FontAwesomeIcon icon={icon} />
    </span>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return <span className={`spinner${small ? ' small' : ''}`} />;
}

export function Loading() {
  return (
    <div className="center">
      <Spinner />
    </div>
  );
}

export function Empty({ icon, title, message }: { icon: IconDefinition; title: string; message?: string }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <FontAwesomeIcon icon={icon} />
      </div>
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="glass card">
      <div className="empty">
        <div className="empty-icon" style={{ color: 'var(--error)', background: 'rgba(220,38,38,0.1)' }}>
          <FontAwesomeIcon icon={faCircleExclamation} />
        </div>
        <h3>Couldn&apos;t load this</h3>
        <p>{getErrorMessage(error)}</p>
        {onRetry ? (
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function InfoRow({ icon, label, children }: { icon: IconDefinition; label: string; children: ReactNode }) {
  return (
    <div className="info-row">
      <span className="info-icon">
        <FontAwesomeIcon icon={icon} />
      </span>
      <div>
        <div className="info-label">{label}</div>
        <div className="info-value">{children}</div>
      </div>
    </div>
  );
}

export function SectionHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      <span className="line" />
      {right}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  // Typing is debounced so every keystroke doesn't hit the server.
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text.trim()), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <label className="search">
      <FontAwesomeIcon icon={faMagnifyingGlass} />
      <input value={text} onChange={(event) => setText(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segment">
      {options.map((option) => (
        <button key={option.value} className={option.value === value ? 'active' : ''} onClick={() => onChange(option.value)}>
          {option.label}
          {option.count ? <span className="seg-count">{option.count > 99 ? '99+' : option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Pager({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <div className="pager">
      <span>
        {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </span>
      <div className="actions">
        <button className="icon-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        <button className="icon-btn" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>
    </div>
  );
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="back-link">
      <FontAwesomeIcon icon={faArrowLeft} /> {label}
    </Link>
  );
}

export function Notice({ tone, icon, children }: { tone: Tone; icon: IconDefinition; children: ReactNode }) {
  return (
    <div className={`notice glass tone-${tone}`}>
      <FontAwesomeIcon icon={icon} />
      <div>{children}</div>
    </div>
  );
}

/**
 * Renders on top of the whole page. Needed because a parent with `backdrop-filter` (every
 * glass card) becomes the containing block for `position: fixed`, which otherwise trapped
 * pop-ups inside the card instead of centring them on the screen.
 */
export function Overlay({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

/** Photos in a row; click one to open the viewer (✕ / Esc / backdrop closes, arrows browse). */
export function Photos({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIndex(null);
      if (event.key === 'ArrowRight') setIndex((current) => (current === null ? null : (current + 1) % urls.length));
      if (event.key === 'ArrowLeft') setIndex((current) => (current === null ? null : (current - 1 + urls.length) % urls.length));
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, urls.length]);

  if (urls.length === 0) return <p className="muted">No photos.</p>;
  const many = urls.length > 1;

  return (
    <>
      <div className="photos">
        {urls.map((url, i) => (
          <img key={url} src={url} alt={`Photo ${i + 1}`} loading="lazy" onClick={() => setIndex(i)} />
        ))}
      </div>
      {index !== null ? (
        <Overlay>
          <div className="viewer" onClick={() => setIndex(null)} role="dialog" aria-modal="true" aria-label="Photo">
            <div className="viewer-top" onClick={(event) => event.stopPropagation()}>
              {many ? (
                <span className="viewer-count">
                  {index + 1} / {urls.length}
                </span>
              ) : (
                <span />
              )}
              <button className="viewer-btn" onClick={() => setIndex(null)} aria-label="Close photo" title="Close (Esc)">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <img className="viewer-img" src={urls[index]} alt="" onClick={(event) => event.stopPropagation()} />
            {many ? (
              <>
                <button
                  className="viewer-btn viewer-prev"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIndex((index - 1 + urls.length) % urls.length);
                  }}
                  aria-label="Previous photo"
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <button
                  className="viewer-btn viewer-next"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIndex((index + 1) % urls.length);
                  }}
                  aria-label="Next photo"
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </>
            ) : null}
          </div>
        </Overlay>
      ) : null}
    </>
  );
}

/** A small square photo beside a row (e.g. a problem's first photo) — never used as a person's avatar. */
export function Thumb({ url, count }: { url: string; count?: number }) {
  return (
    <span className="thumb">
      <img src={url} alt="" loading="lazy" />
      {count && count > 1 ? <span className="thumb-count">+{count - 1}</span> : null}
    </span>
  );
}

const TOAST_ICONS = {
  success: { icon: faCircleCheck, gradient: 'linear-gradient(135deg, #16a34a, #0f7a37)' },
  error: { icon: faCircleExclamation, gradient: 'linear-gradient(135deg, #ef4444, #dc2626)' },
  info: { icon: faCircleInfo, gradient: 'var(--gradient)' },
};

export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);
  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast glass" onClick={() => dismiss(toast.id)}>
          <span className="toast-icon" style={{ background: TOAST_ICONS[toast.variant].gradient }}>
            <FontAwesomeIcon icon={TOAST_ICONS[toast.variant].icon} />
          </span>
          <div style={{ flex: 1 }}>
            <strong>{toast.title}</strong>
            {toast.message ? <span>{toast.message}</span> : null}
          </div>
          <FontAwesomeIcon icon={faXmark} className="muted" />
        </div>
      ))}
    </div>
  );
}
