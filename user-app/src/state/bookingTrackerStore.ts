import { create } from 'zustand';

interface BookingTrackerState {
  /** The Quick Book booking whose tracking screen is open, if any. */
  bookingId: string | null;
  open: (bookingId: string) => void;
  close: () => void;
}

/**
 * Opens the root-mounted BookingTrackingModal from anywhere — right after Quick Book sends a
 * request, from My Bookings, or from Home's active-booking card — without each place needing
 * its own copy of the screen.
 */
export const useBookingTrackerStore = create<BookingTrackerState>((set) => ({
  bookingId: null,
  open: (bookingId) => set({ bookingId }),
  close: () => set({ bookingId: null }),
}));

export const openBookingTracker = (bookingId: string) => useBookingTrackerStore.getState().open(bookingId);
