import { create } from 'zustand';

interface AcceptingState {
  /** A request being accepted right now: AcceptingHost covers the screen until it opens. */
  accepting: 'job' | 'order' | null;
  /** Accept tapped on the floating pop-up ("job-<id>" / "order-<id>"): AcceptingHost accepts it. */
  popupKey: string | null;
  setAccepting: (accepting: 'job' | 'order' | null) => void;
  acceptFromPopup: (key: string) => void;
  clearPopup: () => void;
}

/**
 * Accepting a request (from Live Requests, Home's pile or the floating pop-up) shows one
 * "Accepting…" cover until the job / order screen opens — so the request leaving its list
 * never flashes "0 requests" in between.
 */
export const useAcceptingStore = create<AcceptingState>((set) => ({
  accepting: null,
  popupKey: null,
  setAccepting: (accepting) => set({ accepting }),
  acceptFromPopup: (popupKey) => set({ popupKey }),
  clearPopup: () => set({ popupKey: null }),
}));
