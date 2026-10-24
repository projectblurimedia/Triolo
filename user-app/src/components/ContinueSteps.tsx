import React from 'react';
import { useTranslation } from 'react-i18next';
import { StackStep, StepStack } from './StepStack';
import { useMyBookings } from '@/hooks/useBookings';
import { useMyOrders } from '@/hooks/useOrders';
import { ACTIVE_BOOKING_STATUSES } from '@/services/bookingsService';
import { isOrderOpen, orderStatusTitleKey } from '@/services/ordersService';
import { openBookingTracker } from '@/state/bookingTrackerStore';
import { openOrderTracker } from '@/state/orderTrackerStore';
import { bookingStatusTitle } from '@/utils/bookingStatusText';
import { orderShopName } from '@/utils/orderShopName';

type Step = StackStep & { createdAt: string };

/**
 * Home's "Continue where you left off": every booking (Quick Book or a problem's trip) and shop
 * order still in progress — including a finished order waiting for its rating — each one tap
 * from its tracking screen, so nothing has to be dug out of My Bookings / My Orders after the
 * app was closed or minimised. Renders nothing when nothing is in progress. The Services tab
 * shows only the bookings (`only="bookings"`), the Bazaar tab only the shop orders.
 */
export function ContinueSteps({ only }: { only?: 'bookings' | 'orders' } = {}) {
  const { t } = useTranslation();
  const bookings = useMyBookings();
  const orders = useMyOrders();

  const skills = (keys: string[]) => keys.map((key) => t(`workerProfile.skills.${key}`)).join(', ');

  const steps: Step[] = [
    ...(only === 'orders' ? [] : (bookings.data ?? []))
      .filter((booking) => ACTIVE_BOOKING_STATUSES.includes(booking.status))
      .map<Step>((booking) => {
        const workerName = booking.worker?.fullName ?? null;
        return {
          key: `booking-${booking.id}`,
          icon: booking.problemPostId ? 'clipboard-list' : 'bolt',
          name: workerName ?? booking.directWorker?.fullName ?? t('continueSteps.searching'),
          stepTitle: `${bookingStatusTitle(booking, t)} · ${skills(booking.skillCategories)}`,
          // Name and step say enough here; the full message is on the tracking screen.
          hint: '',
          action: t('continueSteps.continue'),
          createdAt: booking.createdAt,
          onPress: () => openBookingTracker(booking.id),
        };
      }),
    ...(only === 'bookings' ? [] : (orders.data ?? [])).filter(isOrderOpen).map<Step>((order) => {
      const toRate = order.status === 'completed';
      return {
        key: `order-${order.id}`,
        icon: toRate ? 'star' : 'basket-shopping',
        name: orderShopName(order, t),
        stepTitle: `${t(orderStatusTitleKey(order))} · ${t('orders.itemsCount', { count: order.items.length })}`,
        hint: '',
        action: t(toRate ? 'continueSteps.rate' : 'continueSteps.continue'),
        createdAt: order.createdAt,
        onPress: () => openOrderTracker(order.id),
      };
    }),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Right under Home's search bar (which already leaves a gap): little room above, some below.
  return <StepStack title={t('continueSteps.title')} steps={steps} style={{ marginTop: 2, marginBottom: 16 }} />;
}
