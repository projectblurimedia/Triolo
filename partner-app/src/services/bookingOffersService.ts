import { apiClient } from './apiClient';

export interface PendingOffer {
  offerId: string;
  bookingRequestId: string;
  skillCategories: string[];
  distanceMeters: number;
  /** Shown before accepting; the phone number only comes after. */
  customerFullName: string;
  locationAddress: string | null;
  /** The customer chose this worker personally (only they were asked). */
  direct?: boolean;
  createdAt: string;
}

/** Job requests that reached the worker and what became of them. */
export interface OfferStats {
  received: number;
  accepted: number;
  declined: number;
  missed: number;
}

export const bookingOffersService = {
  listMine: () => apiClient.get<PendingOffer[]>('/bookings/offers/mine', true),
  stats: (from?: string, to?: string) => {
    const query = [from ? `from=${encodeURIComponent(from)}` : '', to ? `to=${encodeURIComponent(to)}` : ''].filter(Boolean).join('&');
    return apiClient.get<OfferStats>(`/bookings/offers/stats${query ? `?${query}` : ''}`, true);
  },
  /** "Find jobs now" — picks up every open request nearby, then returns the open offers. */
  search: (here?: { latitude: number; longitude: number }) =>
    apiClient.post<PendingOffer[]>('/bookings/offers/search', here ?? {}, true),
  accept: (bookingRequestId: string) => apiClient.post<null>(`/bookings/${bookingRequestId}/accept`, undefined, true),
  decline: (bookingRequestId: string) => apiClient.post<null>(`/bookings/${bookingRequestId}/decline`, undefined, true),
};
