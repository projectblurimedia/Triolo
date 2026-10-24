import { create } from 'zustand';

interface IncomingState {
  /** The new shop order IncomingOrderModal is showing. */
  orderId: string | null;
  /** The combined "New requests" screen (IncomingRequestsHub) — more than one request at once. */
  listOpen: boolean;
  /** IncomingJobModal is accepting or declining: don't swap it for the list mid-way. */
  jobBusy: boolean;
  focusOrder: (orderId: string) => void;
  clearOrder: () => void;
  openList: () => void;
  closeList: () => void;
  setJobBusy: (busy: boolean) => void;
}

/**
 * Which incoming-request screen is up. IncomingRequestsHub decides: one new request shows its
 * own takeover (a job or an order); two or more together, or a new one while a takeover is
 * open, show one combined list instead of popping up one after another.
 */
export const useIncomingStore = create<IncomingState>((set) => ({
  orderId: null,
  listOpen: false,
  jobBusy: false,
  focusOrder: (orderId) => set({ orderId }),
  clearOrder: () => set({ orderId: null }),
  openList: () => set({ listOpen: true, orderId: null }),
  closeList: () => set({ listOpen: false }),
  setJobBusy: (jobBusy) => set({ jobBusy }),
}));
