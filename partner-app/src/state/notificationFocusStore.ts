import { create } from 'zustand';

interface NotificationFocusState {
  /** A notification to open (a tapped push): the bell's list opens straight on it. */
  focusId: string | null;
  open: (id: string) => void;
  clear: () => void;
}

export const useNotificationFocusStore = create<NotificationFocusState>((set) => ({
  focusId: null,
  open: (focusId) => set({ focusId }),
  clear: () => set({ focusId: null }),
}));
