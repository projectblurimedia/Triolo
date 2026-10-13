import { create } from 'zustand';

interface JobFocusState {
  /** The Quick Book job whose screen (JobTrackingModal) is open, if any. */
  jobId: string | null;
  open: (jobId: string) => void;
  close: () => void;
}

/**
 * Opens the root-mounted JobTrackingModal from anywhere — right after accepting an offer
 * (IncomingJobModal / Bookings list), from the Bookings tab, or from a tapped notification.
 */
export const useJobFocusStore = create<JobFocusState>((set) => ({
  jobId: null,
  open: (jobId) => set({ jobId }),
  close: () => set({ jobId: null }),
}));

export const openJob = (jobId: string) => useJobFocusStore.getState().open(jobId);
