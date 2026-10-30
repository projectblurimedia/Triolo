import { create } from 'zustand';

interface IncomingState {
  /** The new shop order IncomingOrderModal is showing. */
  orderId: string | null;
  /** The combined "New requests" screen (IncomingRequestsHub) — more than one request at once. */
  listOpen: boolean;
  /** Opened from the menu (Live near you): stays open, empty or not. */
  listManual: boolean;
  /** The request to show first (a card tapped on Home). */
  focusKey: string | null;
  /** Accept tapped on the floating card: Live Requests accepts this one as it opens. */
  autoAcceptKey: string | null;
  setAutoAccept: (key: string | null) => void;
  /** IncomingJobModal is accepting or declining: don't swap it for the list mid-way. */
  jobBusy: boolean;
  focusOrder: (orderId: string) => void;
  clearOrder: () => void;
  openList: (manual?: boolean, focusKey?: string) => void;
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
  listManual: false,
  focusKey: null,
  autoAcceptKey: null,
  setAutoAccept: (autoAcceptKey) => set({ autoAcceptKey }),
  jobBusy: false,
  focusOrder: (orderId) => set({ orderId }),
  clearOrder: () => set({ orderId: null }),
  openList: (manual = false, focusKey) => set({ listOpen: true, listManual: manual, focusKey: focusKey ?? null, orderId: null }),
  closeList: () => set({ listOpen: false, listManual: false, focusKey: null }),
  setJobBusy: (jobBusy) => set({ jobBusy }),
}));
