import { create } from 'zustand';

interface DeliveriesState {
  /** The staff deliveries screen (StaffDeliveriesModal) is open. */
  visible: boolean;
  /** A delivery to show expanded first (from a tapped "New delivery" notification). */
  focusId: string | null;
  open: (focusId?: string) => void;
  close: () => void;
}

export const useDeliveriesStore = create<DeliveriesState>((set) => ({
  visible: false,
  focusId: null,
  open: (focusId) => set({ visible: true, focusId: focusId ?? null }),
  close: () => set({ visible: false, focusId: null }),
}));

export const openDeliveries = (focusId?: string) => useDeliveriesStore.getState().open(focusId);
