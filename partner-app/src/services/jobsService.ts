import { apiClient } from './apiClient';

/**
 * accepted → on_the_way (Start Trip) → arrived → in_progress (customer's PIN entered)
 * → work_done → completed (customer confirms and rates). 'cancelled' if the customer cancels
 * before the PIN is verified.
 */
export type JobStatus =
  | 'broadcasting'
  | 'accepted'
  | 'on_the_way'
  | 'arrived'
  | 'in_progress'
  | 'work_done'
  | 'completed'
  | 'cancelled';

export const ACTIVE_JOB_STATUSES: JobStatus[] = ['accepted', 'on_the_way', 'arrived', 'in_progress', 'work_done'];

/** A Quick Book job this worker accepted (their view — includes the customer's contact details, never the PIN). */
export interface WorkerJob {
  id: string;
  status: JobStatus;
  skillCategories: string[];
  latitude: number;
  longitude: number;
  locationAddress: string | null;
  distanceMeters: number | null;
  customerFullName: string;
  customerMobileNumber: string;
  workerLatitude: number | null;
  workerLongitude: number | null;
  pinAttemptsLeft: number;
  acceptedAt: string | null;
  startedAt: string | null;
  arrivedAt: string | null;
  pinVerifiedAt: string | null;
  workDoneAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  /** Set when this job came from an accepted Your Problems post. */
  problemPostId: string | null;
  /** That problem’s quotation in rupees. */
  quotationAmount: number | null;
  workerRating: number | null;
  workerReview: string | null;
  createdAt: string;
}

export const jobsService = {
  listMine: () => apiClient.get<WorkerJob[]>('/bookings/jobs/mine', true),
  get: (id: string) => apiClient.get<WorkerJob>(`/bookings/jobs/${id}`, true),
  startTrip: (id: string) => apiClient.post<null>(`/bookings/${id}/start`, undefined, true),
  updateLocation: (id: string, latitude: number, longitude: number) =>
    apiClient.put<null>(`/bookings/${id}/location`, { latitude, longitude }, true),
  arrive: (id: string) => apiClient.post<null>(`/bookings/${id}/arrive`, undefined, true),
  verifyPin: (id: string, pin: string) => apiClient.post<null>(`/bookings/${id}/verify-pin`, { pin }, true),
  workDone: (id: string) => apiClient.post<null>(`/bookings/${id}/work-done`, undefined, true),
};
