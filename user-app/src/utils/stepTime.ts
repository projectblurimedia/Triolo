/*
 * (Copied between user-app and partner-app — keep in sync.)
 */

// Built by hand — Hermes on Android doesn't reliably ship Intl date formatting.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function clock(date: Date): string {
  const hours = date.getHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(date.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

function day(date: Date): string {
  const year = date.getFullYear() !== new Date().getFullYear() ? ` ${date.getFullYear()}` : '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${year}`;
}

/**
 * A step's time in a job's / order's step list. The first step (when it was ordered) always
 * carries its date — "31 Oct, 2:05 PM"; a later step shows its date again only when it falls
 * on another day than the step before it, otherwise just "4:40 PM".
 */
export function stepTimeText(iso: string, previousIso: string | null): string {
  const date = new Date(iso);
  if (previousIso && new Date(previousIso).toDateString() === date.toDateString()) return clock(date);
  return `${day(date)}, ${clock(date)}`;
}

/** The time of the nearest earlier step that has one (null for the first). */
export function previousStepAt(steps: { at: string | null }[], index: number): string | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (steps[i].at) return steps[i].at;
  }
  return null;
}
