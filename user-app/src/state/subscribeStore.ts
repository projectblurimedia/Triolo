import { create } from 'zustand';

interface SubscribeState {
  /** The root-mounted SubscribeModal is open. */
  visible: boolean;
  open: () => void;
  close: () => void;
}

/**
 * Opens the subscription screen from anywhere: a locked "Subscribe to book" button, the
 * Profile card, or a SUBSCRIPTION_REQUIRED answer from the server (see apiClient).
 */
export const useSubscribeStore = create<SubscribeState>((set) => ({
  visible: false,
  open: () => set({ visible: true }),
  close: () => set({ visible: false }),
}));

export const openSubscribe = () => useSubscribeStore.getState().open();
