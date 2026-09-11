import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingOffersService } from '@/services/bookingOffersService';

export const BOOKING_OFFERS_QUERY_KEY = ['bookingOffers'];
// Push delivery (see usePushNotifications.ts) is what makes a new offer, or a job going to
// someone else, feel real-time — this poll is the in-app-open fallback/refresh, same order
// of magnitude as useNotifications()'s own interval.
const POLL_INTERVAL_MS = 8000;

export function useBookingOffers() {
  return useQuery({
    queryKey: BOOKING_OFFERS_QUERY_KEY,
    queryFn: bookingOffersService.listMine,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useAcceptBookingOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingRequestId: string) => bookingOffersService.accept(bookingRequestId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: BOOKING_OFFERS_QUERY_KEY }),
  });
}
