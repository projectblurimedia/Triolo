import { create } from 'zustand';

interface FullTextState {
  text: string | null;
  /** Where the finger was, so the bubble opens above it. */
  x: number;
  y: number;
}

/** The text a long-press asked to see in full (FullText → FullTextHost). Copied from user-app. */
export const useFullTextStore = create<FullTextState>(() => ({ text: null, x: 0, y: 0 }));

export function showFullText(text: string, x: number, y: number): void {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = null;
  useFullTextStore.setState({ text, x, y });
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function hideFullText(): void {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = null;
  useFullTextStore.setState({ text: null });
}

/** Hides the bubble a moment after the finger lifts. */
export function hideFullTextSoon(ms = 700): void {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(hideFullText, ms);
}
