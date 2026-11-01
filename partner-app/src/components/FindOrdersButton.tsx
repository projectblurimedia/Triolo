import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { FindNowCard } from './FindNowCard';
import { shopOrdersService } from '@/services/shopOrdersService';
import { SHOP_ORDERS_QUERY_KEY } from '@/hooks/useShopOrders';
import { useLocationGatedMutation } from '@/hooks/useLocationGatedMutation';
import { useIncomingStore } from '@/state/incomingStore';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';

/**
 * "Find Orders Now" on My Shop — the shop's Find Jobs Now: asks the server for every Quick
 * Order still looking for a shop near this shop that it can take (its kind of shop; delivery
 * only if it delivers), even one whose notification never came or that it declined. They join
 * the shop's New orders; with any found, Bookings → Shop Orders opens on New.
 */
export function FindOrdersButton() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Location is asked for first, as for every partner action.
  const search = useLocationGatedMutation({
    mutationFn: async (_: void) => {
      // Location first (above), then the search.
      return shopOrdersService.searchQuick();
    },
    onSuccess: (orders) => {
      const open = orders.filter((order) => order.quick && order.status === 'placed' && !order.businessId).length;
      // Found some: they open in the New requests list, not Activity (which is a record).
      if (open > 0) useIncomingStore.getState().openList();
      queryClient.setQueryData(SHOP_ORDERS_QUERY_KEY, orders);
      if (open > 0) {
        showToast({ variant: 'success', title: t('findOrders.foundTitle', { count: open }), message: t('findOrders.foundMessage') });
      } else {
        showToast({ variant: 'info', title: t('findOrders.noneTitle'), message: t('findOrders.noneMessage') });
      }
    },
    onError: (error) =>
      showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) }),
  });

  return (
    <FindNowCard
      eyebrow={t('findOrders.sectionTitle')}
      title={t(search.isPending ? 'findOrders.searching' : 'findOrders.button')}
      hint={t('findOrders.hint')}
      busy={search.isPending}
      onPress={() => search.mutate()}
    />
  );
}
