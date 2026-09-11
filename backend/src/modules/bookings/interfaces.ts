export type BookingRequestStatus = 'broadcasting' | 'accepted';
export type BookingOfferStatus = 'pending' | 'accepted' | 'lost';

export interface BookingRequest {
  id: string;
  accountId: string;
  skillCategories: string[];
  latitude: number;
  longitude: number;
  radiusKm: number;
  status: BookingRequestStatus;
  acceptedWorkerId: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
}

/** What the requester (user-app) polls while waiting — see BookingsService.getRequestStatus. */
export interface BookingRequestWithAcceptedWorker extends BookingRequest {
  acceptedWorkerFullName: string | null;
  acceptedWorkerSkillCategories: string[] | null;
}

export interface CreateBookingRequestParams {
  accountId: string;
  skillCategories: string[];
  latitude: number;
  longitude: number;
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

/** A losing worker's account, kept alongside their language so the "taken" push can be localized. */
export interface LosingWorker {
  accountId: string;
  preferredLanguage: 'en' | 'te';
}

export type AcceptOfferResult =
  | { won: false }
  | { won: true; request: BookingRequest; losingWorkers: LosingWorker[] };
