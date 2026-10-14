import { create } from 'zustand';

interface OrderTrackerState {
  /** The shop order whose screen (OrderTrackingModal) is open, if any. */
  orderId: string | null;
  open: (orderId: string) => void;
  close: () => void;
}

/**
 * Opens the root-mounted OrderTrackingModal from anywhere — right after sending a list to a
 * shop, from My Orders, from Home, or from a tapped order notification.
 */
export const useOrderTrackerStore = create<OrderTrackerState>((set) => ({
  orderId: null,
  open: (orderId) => set({ orderId }),
  close: () => set({ orderId: null }),
}));

export const openOrderTracker = (orderId: string) => useOrderTrackerStore.getState().open(orderId);
