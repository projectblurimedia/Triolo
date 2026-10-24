import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/services/apiClient';
import { CustomerBooking } from '@/services/bookingsService';
import { MY_BOOKINGS_QUERY_KEY } from '@/hooks/useBookings';

/**
 * A Quick Book of this customer still looking for a worker for some of the same work. Booking
 * it again would only send the same workers the same job twice, so the app opens the waiting
 * one instead (the server refuses a repeat too: BOOKING_ALREADY_WAITING).
 */
export function findWaitingQuickBook(queryClient: QueryClient, skills: string[]): CustomerBooking | null {
  const wanted = new Set(skills.map((skill) => skill.toLowerCase()));
  const list = queryClient.getQueryData<CustomerBooking[]>(MY_BOOKINGS_QUERY_KEY) ?? [];
  return (
    list.find(
      (booking) =>
        booking.status === 'broadcasting' &&
        !booking.directWorker &&
        booking.skillCategories.some((skill) => wanted.has(skill.toLowerCase())),
    ) ?? null
  );
}

/** The waiting request the server pointed to when it refused a repeat, if that is this error. */
export function waitingBookingIdFrom(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== 'BOOKING_ALREADY_WAITING') return null;
  const details = error.details as { bookingRequestId?: string } | undefined;
  return details?.bookingRequestId ?? null;
}
