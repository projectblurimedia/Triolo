import { apiClient } from './apiClient';

export type BookingRequestStatus = 'broadcasting' | 'accepted';

export interface CreateQuickBookingParams {
  skillCategories: string[];
  latitude: number;
  longitude: number;
  radiusKm?: number;
}

export interface CreateQuickBookingResult {
  bookingRequestId: string;
  matchedWorkerCount: number;
}

export interface BookingRequestStatusResult {
  id: string;
  status: BookingRequestStatus;
  skillCategories: string[];
  acceptedWorkerFullName: string | null;
  acceptedWorkerSkillCategories: string[] | null;
}

export const bookingsService = {
  createQuickBooking: (params: CreateQuickBookingParams) =>
    apiClient.post<CreateQuickBookingResult>('/bookings/quick', params, true),

  getStatus: (bookingRequestId: string) =>
    apiClient.get<BookingRequestStatusResult>(`/bookings/${bookingRequestId}`, true),
};
