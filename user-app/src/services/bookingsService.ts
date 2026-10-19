import { apiClient } from './apiClient';

/**
 * broadcasting → accepted → on_the_way → arrived → in_progress (PIN verified) → work_done
 * → completed; 'cancelled' any time before the PIN is verified.
 */
export type BookingRequestStatus =
  | 'broadcasting'
  | 'accepted'
  | 'on_the_way'
  | 'arrived'
  | 'in_progress'
  | 'work_done'
  | 'completed'
  | 'cancelled'
  /** No worker accepted within a few minutes. */
  | 'expired';

export const ACTIVE_BOOKING_STATUSES: BookingRequestStatus[] = [
  'broadcasting',
  'accepted',
  'on_the_way',
  'arrived',
  'in_progress',
  'work_done',
];
/** The worker is assigned and travelling / at the door — map, live location and PIN apply. */
export const TRIP_STATUSES: BookingRequestStatus[] = ['accepted', 'on_the_way', 'arrived'];
export const CANCELLABLE_STATUSES: BookingRequestStatus[] = ['broadcasting', 'accepted', 'on_the_way', 'arrived'];

export interface CreateQuickBookingParams {
  skillCategories: string[];
  latitude: number;
  longitude: number;
  radiusKm?: number;
  locationAddress?: string;
}

export interface CreateQuickBookingResult {
  bookingRequestId: string;
  matchedWorkerCount: number;
}

export interface BookingWorker {
  fullName: string;
  mobileNumber: string;
  skillCategories: string[];
  ratingAverage: number | null;
  ratingCount: number;
  latitude: number | null;
  longitude: number | null;
  locationUpdatedAt: string | null;
}

/** The customer's view of one Quick Book booking. */
export interface CustomerBooking {
  id: string;
  status: BookingRequestStatus;
  skillCategories: string[];
  latitude: number;
  longitude: number;
  locationAddress: string | null;
  acceptedAt: string | null;
  startedAt: string | null;
  arrivedAt: string | null;
  pinVerifiedAt: string | null;
  workDoneAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  /** Who cancelled: the customer, or the worker backing out before the PIN. */
  cancelledBy: 'customer' | 'worker' | 'admin' | null;
  cancelReason: string | null;
  workerRating: number | null;
  workerReview: string | null;
  /** Set when this booking is a Your Problems job a worker accepted. */
  problemPostId: string | null;
  /** That problem’s quotation in rupees. */
  quotationAmount: number | null;
  createdAt: string;
  worker: BookingWorker | null;
  /** Shown while the worker is on the way / at the door; the worker never receives it. */
  arrivalPin: string | null;
  /** Set when the customer booked this worker personally (shown while waiting for them). */
  directWorker?: { fullName: string } | null;
}

export interface CreateDirectBookingParams {
  workerId: string;
  skillCategories: string[];
  latitude: number;
  longitude: number;
  locationAddress?: string;
}

export const bookingsService = {
  createQuickBooking: (params: CreateQuickBookingParams) =>
    apiClient.post<CreateQuickBookingResult>('/bookings/quick', params, true),

  /** Book one particular worker: only they are asked. */
  createDirectBooking: (params: CreateDirectBookingParams) =>
    apiClient.post<{ bookingRequestId: string }>('/bookings/direct', params, true),

  getBooking: (bookingRequestId: string) => apiClient.get<CustomerBooking>(`/bookings/${bookingRequestId}`, true),

  listMine: () => apiClient.get<CustomerBooking[]>('/bookings/mine', true),

  /** With a rating: cancelling a worker who's over an hour late (they get the rating). */
  cancel: (bookingRequestId: string, late?: { rating: number; review?: string }) =>
    apiClient.post<null>(
      `/bookings/${bookingRequestId}/cancel`,
      late ? { rating: late.rating, review: late.review || undefined } : undefined,
      true,
    ),

  complete: (bookingRequestId: string, rating: number, review?: string) =>
    apiClient.post<null>(`/bookings/${bookingRequestId}/complete`, { rating, review: review || undefined }, true),
};
