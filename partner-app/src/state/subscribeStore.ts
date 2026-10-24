import { create } from 'zustand';

interface SubscribeState {
  /** The root-mounted SubscribeModal is open. */
  visible: boolean;
  open: () => void;
  close: () => void;
}

/** Opens the partner subscription screen from anywhere (Profile, the menu, a notification). */
export const useSubscribeStore = create<SubscribeState>((set) => ({
  visible: false,
  open: () => set({ visible: true }),
  close: () => set({ visible: false }),
}));

export const openSubscribe = () => useSubscribeStore.getState().open();
