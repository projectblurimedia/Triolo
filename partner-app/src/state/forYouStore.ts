import { create } from 'zustand';

export type ForYouMode = 'new' | 'problems' | 'continue';

interface ForYouState {
  /** Which list ForYouModal shows (null: closed). */
  mode: ForYouMode | null;
  open: (mode: ForYouMode) => void;
  close: () => void;
}

/** Opens the root-mounted ForYouModal from the menu: New for you, Problems near you, Continue. */
export const useForYouStore = create<ForYouState>((set) => ({
  mode: null,
  open: (mode) => set({ mode }),
  close: () => set({ mode: null }),
}));

export const openForYou = (mode: ForYouMode) => useForYouStore.getState().open(mode);
