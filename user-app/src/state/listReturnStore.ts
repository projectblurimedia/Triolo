import { create } from 'zustand';

/** The tab a "make a new list" detour started from. */
export type ListReturnOrigin = 'Home' | 'Bazaar';

/** A detour older than this is forgotten (the person went off to do something else). */
const RETURN_WINDOW_MS = 30 * 60 * 1000;

interface ListReturnState {
  /** Quick Order sent the person to make a list, from this tab. */
  origin: ListReturnOrigin | null;
  startedAt: number;
  /** The list just made: the origin tab reopens Quick Order with it, then clears this. */
  reopen: { origin: ListReturnOrigin; listId: string } | null;
  start: (origin: ListReturnOrigin) => void;
  cancel: () => void;
  /** The new list was saved: returns the tab to go back to, or null when there's no detour. */
  done: (listId: string) => ListReturnOrigin | null;
  clearReopen: () => void;
}

/**
 * Quick Order → Make a new list → (Prepare List editor) → Save → back to Quick Order with that
 * list chosen. Kept only in memory: a restart simply forgets the detour.
 */
export const useListReturnStore = create<ListReturnState>((set, get) => ({
  origin: null,
  startedAt: 0,
  reopen: null,
  start: (origin) => set({ origin, startedAt: Date.now(), reopen: null }),
  cancel: () => set({ origin: null }),
  done: (listId) => {
    const { origin, startedAt } = get();
    if (!origin || Date.now() - startedAt > RETURN_WINDOW_MS) {
      set({ origin: null });
      return null;
    }
    set({ origin: null, reopen: { origin, listId } });
    return origin;
  },
  clearReopen: () => set({ reopen: null }),
}));
