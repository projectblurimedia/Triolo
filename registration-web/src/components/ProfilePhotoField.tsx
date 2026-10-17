import { useEffect, useMemo, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera } from '@fortawesome/free-solid-svg-icons';

interface ProfilePhotoFieldProps {
  file: File | null;
  /** Initials are drawn from this when there's no photo. */
  name: string;
  title: string;
  hint: string;
  onChange: (file: File | null) => void;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.length === 1 ? parts[0][0].toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** The round profile photo at the top of the registration form (same as the Partner app). */
export function ProfilePhotoField({ file, name, title, hint, onChange }: ProfilePhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  return (
    <div className="profile-photo">
      <button type="button" className="profile-photo__ring" onClick={() => inputRef.current?.click()} aria-label={title}>
        {preview ? (
          <img src={preview} alt="" className="profile-photo__img" />
        ) : (
          <span className="profile-photo__initials">{initialsOf(name)}</span>
        )}
        <span className="profile-photo__badge">
          <FontAwesomeIcon icon={faCamera} />
        </span>
      </button>
      <div>
        <div className="profile-photo__title">{title}</div>
        <div className="profile-photo__hint">{hint}</div>
        <div className="profile-photo__links">
          <button type="button" onClick={() => inputRef.current?.click()}>
            {file ? 'Change' : 'Add photo'}
          </button>
          {file ? (
            <button type="button" className="profile-photo__remove" onClick={() => onChange(null)}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onChange(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
    </div>
  );
}
