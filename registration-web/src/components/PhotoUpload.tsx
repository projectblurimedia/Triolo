import { useRef } from 'react';

interface PhotoUploadProps {
  label: string;
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
}

/** Native <input type="file" multiple> instead of expo-image-picker — the browser equivalent needs no permission-prompt handling. */
export function PhotoUpload({ label, files, onChange, maxFiles = 6 }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    onChange([...files, ...picked].slice(0, maxFiles));
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="field">
      <label>{label}</label>
      <div className="photo-row">
        {files.map((file, index) => (
          <div key={`${file.name}-${index}`} style={{ position: 'relative' }}>
            <img src={URL.createObjectURL(file)} alt="" className="photo-thumb" />
            <button
              type="button"
              onClick={() => handleRemove(index)}
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                width: 20,
                height: 20,
                borderRadius: 10,
                background: '#DC2626',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        ))}
        {files.length < maxFiles ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              width: 72,
              height: 72,
              borderRadius: 10,
              border: '1px dashed var(--color-border)',
              background: 'var(--color-background)',
              cursor: 'pointer',
              fontSize: 22,
              color: 'var(--color-text-muted)',
            }}
          >
            +
          </button>
        ) : null}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={handlePick} />
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
        {files.length}/{maxFiles} photos added
      </p>
    </div>
  );
}
