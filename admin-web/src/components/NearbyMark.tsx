import { useId } from 'react';

/**
 * The NearbyU mark (pin, road and home forming a U), in the current text colour — the same mark
 * the apps use. (Copied between registration-web, ads-web and admin-web — keep in sync.)
 */
export function NearbyMark({ size = 22 }: { size?: number }) {
  // useId gives ":r0:"-style ids; colons don't work inside url(#…).
  const id = `nm${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg viewBox="10 10 104 100" width={size} height={size} aria-hidden="true" focusable="false">
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="130" height="130">
          <path d="M27 54V70A33 33 0 0 0 93 70V58H79V70A19 19 0 0 1 41 70V54Z" fill="#fff" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M34 60V70A26 26 0 0 0 86 70V62" fill="none" stroke="#000" strokeWidth="2.4" strokeDasharray="4 5.5" strokeLinecap="round" />
          <path d="M68 59V40H62L86 16L110 40H104V59Z" fill="#fff" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M79.5 59.5V50.5a6.5 6.5 0 0 1 13 0V59.5Z" fill="#000" />
          <circle cx="89.3" cy="54.5" r="1.4" fill="#fff" />
          <path d="M34 57C29 50.5 17 40.5 17 26.5A17 17 0 0 1 51 26.5C51 40.5 39 50.5 34 57Z" fill="#fff" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="34" cy="26.5" r="6.6" fill="#000" />
        </mask>
      </defs>
      <rect x="0" y="0" width="130" height="130" fill="currentColor" mask={`url(#${id})`} />
    </svg>
  );
}
