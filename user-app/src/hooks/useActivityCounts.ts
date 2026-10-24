import { useMyBookings } from './useBookings';
import { useMyOrders } from './useOrders';
import { ACTIVE_BOOKING_STATUSES } from '@/services/bookingsService';
import { isOrderOpen } from '@/services/ordersService';

/**
 * What is still in progress, per tab: bookings (Quick Book, a worker booked personally, a
 * problem's trip) for Services, and shop orders (including one waiting for its rating) for
 * Bazaar. The same items "Continue where you left off" lists; the tab bar shows these counts.
 */
export function useActivityCounts() {
  const bookings = useMyBookings();
  const orders = useMyOrders();
  return {
    services: (bookings.data ?? []).filter((booking) => ACTIVE_BOOKING_STATUSES.includes(booking.status)).length,
    bazaar: (orders.data ?? []).filter(isOrderOpen).length,
  };
}
