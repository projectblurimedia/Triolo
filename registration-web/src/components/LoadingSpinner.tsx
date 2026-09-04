import type { CSSProperties } from 'react';

const style: CSSProperties = {
  width: 20,
  height: 20,
  border: '2.5px solid rgba(255,255,255,0.5)',
  borderTopColor: '#fff',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

/** Injected once — Vite's plain CSS import doesn't give us a good place for a single global @keyframes without a dedicated file, and this is the only place it's used. */
const KEYFRAMES = '@keyframes spin { to { transform: rotate(360deg); } }';

export function LoadingSpinner({ dark = false }: { dark?: boolean }) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <span
        style={dark ? { ...style, border: '2.5px solid rgba(0,0,0,0.15)', borderTopColor: 'var(--color-primary)' } : style}
      />
    </>
  );
}
