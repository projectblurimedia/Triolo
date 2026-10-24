import React from 'react';
import { useTranslation } from 'react-i18next';
import { StackStep, StepStack } from './StepStack';
import { useBookingOffers } from '@/hooks/useBookingOffers';
import { useShopOrders } from '@/hooks/useShopOrders';
import { NEW_ORDER_STATUSES } from '@/services/shopOrdersService';
import { formatDistance } from '@/utils/formatDistance';
import { usePendingOfferStore } from '@/state/pendingOfferStore';
import { openShopOrder } from '@/state/shopOrderFocusStore';

/**
 * Home's "New for you", at the very top: requests waiting for an answer — job requests and new
 * shop orders — each one tap from where it's answered. (Alerts live under the header's bell.)
 * Renders nothing when there's nothing new.
 */
export function NewForYou({ isWorker, isShop }: { isWorker: boolean; isShop: boolean }) {
  const { t } = useTranslation();
  const offers = useBookingOffers();
  const orders = useShopOrders(isShop);

  const skills = (keys: string[]) => keys.map((key) => t(`workerProfile.skills.${key}`)).join(', ');

  const steps: StackStep[] = [
    ...(isWorker ? (offers.data ?? []) : []).map<StackStep>((offer) => ({
      key: `offer-${offer.bookingRequestId}`,
      icon: offer.direct ? 'user-check' : 'bolt',
      name: offer.customerFullName,
      stepTitle: `${t(offer.direct ? 'newForYou.bookedYou' : 'newForYou.jobRequest')} · ${skills(offer.skillCategories)}`,
      hint: t('newForYou.jobHint', { distance: formatDistance(offer.distanceMeters) }),
      action: t('newForYou.view'),
      onPress: () => usePendingOfferStore.getState().setFocusedOffer(offer.bookingRequestId, false),
    })),
    ...(isShop ? (orders.data ?? []) : [])
      .filter((order) => NEW_ORDER_STATUSES.includes(order.status))
      .map<StackStep>((order) => ({
        key: `order-${order.id}`,
        icon: 'basket-shopping',
        name: order.customerFullName,
        stepTitle: `${t('newForYou.newOrder')} · ${t('continueSteps.itemCount', { count: order.items.length })}`,
        hint: t('newForYou.orderHint'),
        action: t('newForYou.view'),
        onPress: () => openShopOrder(order.id),
      })),
  ];

  return <StepStack title={t('newForYou.title')} steps={steps} style={{ marginTop: 0, marginBottom: 18 }} />;
}
