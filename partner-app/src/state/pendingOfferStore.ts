import { create } from 'zustand';

interface PendingOfferState {
  /** Set when a Quick Book push notification's body (not an Accept/Reject action) is
   * tapped — BookingsScreen reads this to open a focused single-offer view for exactly that
   * job instead of just landing on the general list, and clears it once shown. */
  focusedBookingRequestId: string | null;
  setFocusedOffer: (bookingRequestId: string) => void;
  clearFocusedOffer: () => void;
}

export const usePendingOfferStore = create<PendingOfferState>((set) => ({
  focusedBookingRequestId: null,
  setFocusedOffer: (bookingRequestId) => set({ focusedBookingRequestId: bookingRequestId }),
  clearFocusedOffer: () => set({ focusedBookingRequestId: null }),
}));
