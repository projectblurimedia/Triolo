import { apiClient } from './apiClient';

export interface PendingOffer {
  offerId: string;
  bookingRequestId: string;
  skillCategories: string[];
  distanceMeters: number;
  /** Shown before accepting; the phone number only comes after. */
  customerFullName: string;
  locationAddress: string | null;
  createdAt: string;
}

export const bookingOffersService = {
  listMine: () => apiClient.get<PendingOffer[]>('/bookings/offers/mine', true),
  /** "Find jobs now" — picks up every open request nearby, then returns the open offers. */
  search: (here?: { latitude: number; longitude: number }) =>
    apiClient.post<PendingOffer[]>('/bookings/offers/search', here ?? {}, true),
  accept: (bookingRequestId: string) => apiClient.post<null>(`/bookings/${bookingRequestId}/accept`, undefined, true),
  decline: (bookingRequestId: string) => apiClient.post<null>(`/bookings/${bookingRequestId}/decline`, undefined, true),
};
