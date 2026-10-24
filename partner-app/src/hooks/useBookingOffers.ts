import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingOffersService } from '@/services/bookingOffersService';
import { useAuthStore } from '@/state/authStore';
import { useLocationGatedMutation } from './useLocationGatedMutation';

export const BOOKING_OFFERS_QUERY_KEY = ['bookingOffers'];
// Push delivery (see usePushNotifications.ts) is what makes a new offer, or a job going to
// someone else, feel real-time — this poll is the in-app-open fallback/refresh, same order
// of magnitude as useNotifications()'s own interval.
const POLL_INTERVAL_MS = 8000;

/**
 * Gated on `accessToken` — `IncomingJobModal` (see App.tsx) calls this from the true app
 * root, mounted regardless of auth state, so without this gate the app would poll this
 * authenticated endpoint every 8s even on the Welcome/Login/Registration screens, before
 * any session exists (every request would just 401).
 */
export function useBookingOffers() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: BOOKING_OFFERS_QUERY_KEY,
    queryFn: bookingOffersService.listMine,
    refetchInterval: POLL_INTERVAL_MS,
    enabled: !!accessToken,
  });
}

export function useAcceptBookingOffer() {
  const queryClient = useQueryClient();
  // Location must be on to take a job (as for every partner action) — asked for first.
  return useLocationGatedMutation({
    mutationFn: (bookingRequestId: string) => bookingOffersService.accept(bookingRequestId),
    // No partner plan: one paid accept.
    payKind: 'accept',
    onSettled: () => queryClient.invalidateQueries({ queryKey: BOOKING_OFFERS_QUERY_KEY }),
  });
}

export function useDeclineBookingOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingRequestId: string) => bookingOffersService.decline(bookingRequestId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: BOOKING_OFFERS_QUERY_KEY }),
  });
}
