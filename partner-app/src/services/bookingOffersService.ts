import { apiClient } from './apiClient';

export interface PendingOffer {
  offerId: string;
  bookingRequestId: string;
  skillCategories: string[];
  distanceMeters: number;
  createdAt: string;
}

export const bookingOffersService = {
  listMine: () => apiClient.get<PendingOffer[]>('/bookings/offers/mine', true),
  accept: (bookingRequestId: string) => apiClient.post<null>(`/bookings/${bookingRequestId}/accept`, undefined, true),
  decline: (bookingRequestId: string) => apiClient.post<null>(`/bookings/${bookingRequestId}/decline`, undefined, true),
};
