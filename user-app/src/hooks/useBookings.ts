import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ACTIVE_BOOKING_STATUSES, bookingsService, TRIP_STATUSES } from '@/services/bookingsService';
import { useAuthStore } from '@/state/authStore';

export const MY_BOOKINGS_QUERY_KEY = ['bookings', 'mine'];
export const bookingQueryKey = (id: string | null) => ['bookings', 'detail', id];

// How often the tracking screen refreshes: fast while the worker is moving (their live
// position), slower once the work itself is underway, not at all once it's over.
const TRIP_POLL_MS = 4000;
const WAITING_POLL_MS = 4000;
const WORK_POLL_MS = 10000;
const HISTORY_POLL_MS = 20000;

export function useBooking(id: string | null) {
  return useQuery({
    queryKey: bookingQueryKey(id),
    queryFn: () => bookingsService.getBooking(id as string),
    enabled: id !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === 'broadcasting') return WAITING_POLL_MS;
      if (TRIP_STATUSES.includes(status)) return TRIP_POLL_MS;
      if (ACTIVE_BOOKING_STATUSES.includes(status)) return WORK_POLL_MS;
      return false;
    },
  });
}

/** Booking history (and the Home active-booking card). */
export function useMyBookings(enabled = true) {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: MY_BOOKINGS_QUERY_KEY,
    queryFn: bookingsService.listMine,
    enabled: enabled && !!accessToken,
    refetchInterval: enabled ? HISTORY_POLL_MS : false,
  });
}

function useInvalidateBooking() {
  const queryClient = useQueryClient();
  return (id: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: bookingQueryKey(id) }),
      queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_QUERY_KEY }),
      // A problem job runs as a booking — finishing or cancelling it changes the problem too.
      queryClient.invalidateQueries({ queryKey: ['problems', 'mine'] }),
    ]);
}

export function useCancelBooking() {
  const invalidate = useInvalidateBooking();
  return useMutation({
    mutationFn: (id: string) => bookingsService.cancel(id),
    onSettled: (_data, _error, id) => invalidate(id),
  });
}

export function useCompleteBooking() {
  const invalidate = useInvalidateBooking();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rating, review }: { id: string; rating: number; review?: string }) =>
      bookingsService.complete(id, rating, review),
    onSettled: (_data, _error, variables) => {
      invalidate(variables.id);
      // The worker's average just changed — refresh nearby-worker lists too.
      queryClient.invalidateQueries({ queryKey: ['workers', 'nearby'] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}
