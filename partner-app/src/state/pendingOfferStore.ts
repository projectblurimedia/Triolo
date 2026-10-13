import { create } from 'zustand';

interface PendingOfferState {
  /** The Quick Book offer IncomingJobModal is showing — set when an offer push arrives while
   * the app is open, or when its notification is tapped. */
  focusedBookingRequestId: string | null;
  /** True when the worker already tapped Accept on the notification itself: the modal opens
   * with Accept spinning and accepts on its own, then hands off to the job screen. */
  autoAccept: boolean;
  setFocusedOffer: (bookingRequestId: string, autoAccept?: boolean) => void;
  clearFocusedOffer: () => void;
}

export const usePendingOfferStore = create<PendingOfferState>((set) => ({
  focusedBookingRequestId: null,
  autoAccept: false,
  setFocusedOffer: (bookingRequestId, autoAccept = false) => set({ focusedBookingRequestId: bookingRequestId, autoAccept }),
  clearFocusedOffer: () => set({ focusedBookingRequestId: null, autoAccept: false }),
}));
