import { PreferredLanguage } from '@/modules/auth/interfaces';

/**
 * broadcasting → accepted → on_the_way → arrived → in_progress (PIN verified) → work_done
 * → completed. 'cancelled' is reachable by the customer any time before the PIN is verified.
 * 'expired': no worker accepted within BROADCAST_TTL_MINUTES.
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
  | 'expired';
export type BookingOfferStatus = 'pending' | 'accepted' | 'lost' | 'declined';

/** Statuses during which the customer sees the PIN and the worker's live location. */
export const TRIP_STATUSES: BookingRequestStatus[] = ['accepted', 'on_the_way', 'arrived'];
/** The customer can cancel up to (not including) PIN verification. */
export const CANCELLABLE_STATUSES: BookingRequestStatus[] = ['broadcasting', 'accepted', 'on_the_way', 'arrived'];
export const MAX_PIN_ATTEMPTS = 5;
/**
 * How long a Quick Book request keeps looking for a worker. After this it is 'expired' and no
 * longer offered to anyone — the customer gets a "no worker found, try again" screen.
 */
export const BROADCAST_TTL_MINUTES = 3;

export interface BookingRequest {
  id: string;
  accountId: string;
  skillCategories: string[];
  latitude: number;
  longitude: number;
  locationAddress: string | null;
  radiusKm: number;
  status: BookingRequestStatus;
  acceptedWorkerId: string | null;
  acceptedAt: Date | null;
  startedAt: Date | null;
  arrivedAt: Date | null;
  pinVerifiedAt: Date | null;
  workDoneAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  expiredAt: Date | null;
  workerRating: number | null;
  workerReview: string | null;
  /** Set when this trip was started from an accepted Your Problems post. */
  problemPostId: string | null;
  /** That problem's quotation (whole rupees), shown on both trip screens. */
  quotationAmount: number | null;
  createdAt: Date;
}

/** The accepted worker as the customer sees them (contact details only once accepted). */
export interface BookingWorker {
  fullName: string;
  mobileNumber: string;
  skillCategories: string[];
  ratingAverage: number | null;
  ratingCount: number;
  /** Live position — only while the trip is active (accepted / on the way / arrived). */
  latitude: number | null;
  longitude: number | null;
  locationUpdatedAt: Date | null;
}

/** The customer's view of one booking — polled by user-app's tracking screen. */
export interface CustomerBooking extends BookingRequest {
  worker: BookingWorker | null;
  /** Only while the trip is active; the worker never receives this. */
  arrivalPin: string | null;
  /** Kept for the older QuickBookModal build that reads these two flat fields. */
  acceptedWorkerFullName: string | null;
  acceptedWorkerSkillCategories: string[] | null;
}

/** The worker's view of a job they accepted — includes the customer's contact details. */
export interface WorkerJob extends BookingRequest {
  customerFullName: string;
  customerMobileNumber: string;
  distanceMeters: number | null;
  /** Their own latest shared position. */
  workerLatitude: number | null;
  workerLongitude: number | null;
  pinAttemptsLeft: number;
}

export interface CreateBookingRequestParams {
  accountId: string;
  skillCategories: string[];
  latitude: number;
  longitude: number;
  locationAddress: string | null;
  radiusKm: number;
}

export interface BookingOfferInsert {
  workerId: string;
  distanceMeters: number;
}

/** A worker's own view of one still-open offer — feeds partner-app's Bookings tab list. */
export interface PendingOffer {
  offerId: string;
  bookingRequestId: string;
  skillCategories: string[];
  distanceMeters: number;
  createdAt: Date;
}

/** An account to notify, with their language so the push can be localized. */
export interface NotifyTarget {
  accountId: string;
  preferredLanguage: PreferredLanguage;
}

/** A losing worker's account, kept alongside their language so the "taken" push can be localized. */
export type LosingWorker = NotifyTarget;

export type AcceptOfferResult =
  | { won: false }
  | { won: true; request: BookingRequest; customer: NotifyTarget; losingWorkers: LosingWorker[] };

/** A status change, with whoever should be told about it (null when nobody needs telling). */
export interface BookingTransition {
  request: BookingRequest;
  notify: NotifyTarget | null;
}

export type VerifyPinResult =
  | { outcome: 'not_found' }
  | { outcome: 'locked' }
  | { outcome: 'wrong'; attemptsLeft: number }
  | { outcome: 'verified'; transition: BookingTransition };

/** Starts an already-accepted trip for a Your Problems post the worker just accepted. */
export interface CreateAssignedBookingParams {
  customerAccountId: string;
  workerId: string;
  skillCategories: string[];
  latitude: number;
  longitude: number;
  locationAddress: string | null;
  distanceMeters: number | null;
  problemPostId: string;
  quotationAmount: number;
  arrivalPin: string;
}

/**
 * Told when a trip that came from a problem post finishes or is cancelled, so the problems
 * module can update its own post. Set by the composition root (routes.ts) to break the
 * problems -> bookings -> problems construction cycle.
 */
export interface BookingLifecycleListener {
  onProblemTripCompleted(problemPostId: string, rating: number | null, review: string | null): Promise<void>;
  onProblemTripCancelled(problemPostId: string): Promise<void>;
}

/** A finished job's rating/feedback, for the worker's public reviews. */
export interface RatedJob {
  rating: number | null;
  review: string | null;
  customerFullName: string;
  skillCategories: string[];
  completedAt: Date;
}
