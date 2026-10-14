import { create } from 'zustand';

interface ShopOrderFocusState {
  /** The shop order whose screen (ShopOrderModal) is open, if any. */
  orderId: string | null;
  open: (orderId: string) => void;
  close: () => void;
}

/** Opens the root-mounted ShopOrderModal from anywhere — the order lists or a tapped "New Order" notification. */
export const useShopOrderFocusStore = create<ShopOrderFocusState>((set) => ({
  orderId: null,
  open: (orderId) => set({ orderId }),
  close: () => set({ orderId: null }),
}));

export const openShopOrder = (orderId: string) => useShopOrderFocusStore.getState().open(orderId);
