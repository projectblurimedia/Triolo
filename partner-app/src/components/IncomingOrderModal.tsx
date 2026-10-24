import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { IncomingRequestScreen } from './IncomingRequestScreen';
import { useShopOrderAction, useShopOrders } from '@/hooks/useShopOrders';
import { shopOrdersService } from '@/services/shopOrdersService';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { useAuthStore } from '@/state/authStore';
import { openShopOrder, useShopOrderFocusStore } from '@/state/shopOrderFocusStore';
import { useIncomingStore } from '@/state/incomingStore';
import { ShopOrder } from '@/services/shopOrdersService';
import { formatDistance } from '@/utils/formatDistance';
import { typography, useThemeColors } from '@/theme';

// Lets the order screen finish fading in on top before this one closes underneath it.
const MODAL_HANDOFF_MS = 350;
const PREVIEW_ITEMS = 4;

/**
 * The shop's "new order" takeover — the same full-screen request screen as a Quick Book job.
 * Mounted once at the app root; IncomingRequestsHub opens it (incomingStore.orderId) when a
 * list in `placed` comes in on its own, so it pops up over whatever screen is open. "Open Order" opens the order screen (accept, pack, bill);
 * "Decline" turns the list down (the customer is told to try another shop); Back just closes
 * this — the order stays in Bookings → Orders.
 */
export function IncomingOrderModal() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { data: shop } = useMyBusinessProfile(!!accessToken);
  const { data: orders } = useShopOrders(!!shop);
  const orderScreenOpen = useShopOrderFocusStore((state) => state.orderId !== null);
  const focusedId = useIncomingStore((state) => state.orderId);
  const clearOrder = useIncomingStore((state) => state.clearOrder);
  const [handingOff, setHandingOff] = useState(false);
  const lastOrderRef = useRef<ShopOrder | null>(null);
  const declineOrder = useShopOrderAction(({ id }: { id: string }) => shopOrdersService.decline(id));

  const liveOrder = orders?.find((order) => order.id === focusedId) ?? null;
  if (liveOrder) lastOrderRef.current = liveOrder;
  const order = liveOrder ?? (handingOff ? lastOrderRef.current : null);
  // Accepted, cancelled or expired while this was up.
  const gone = !!focusedId && !handingOff && (!liveOrder || liveOrder.status !== 'placed');

  const close = () => clearOrder();

  const decline = () => {
    if (!order || gone) {
      close();
      return;
    }
    declineOrder.mutate(
      { id: order.id },
      {
        onSuccess: () => {
          showToast({ variant: 'info', title: t('shopOrders.declinedToast') });
          close();
        },
        onError: (err) => showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(err, t) }),
      },
    );
  };

  const openOrder = () => {
    if (!order) return;
    setHandingOff(true);
    openShopOrder(order.id);
    setTimeout(() => {
      clearOrder();
      setHandingOff(false);
    }, MODAL_HANDOFF_MS);
  };

  const itemChips = (order?.items ?? []).slice(0, PREVIEW_ITEMS).map((item) => ({
    icon: 'basket-shopping' as const,
    label: [item.name, item.quantity, item.unit].filter(Boolean).join(' '),
  }));
  const moreCount = (order?.items.length ?? 0) - PREVIEW_ITEMS;
  if (moreCount > 0) itemChips.push({ icon: 'basket-shopping' as const, label: t('shopOrders.moreItems', { count: moreCount }) });

  return (
    <IncomingRequestScreen
      visible={focusedId !== null && !orderScreenOpen}
      onRequestClose={() => !declineOrder.isPending && close()}
      kicker={t('shopOrders.newOrderKicker')}
      icon="basket-shopping"
      state={gone ? 'gone' : order ? 'ready' : 'loading'}
      goneTitle={t('shopOrders.orderGoneTitle')}
      goneMessage={t('shopOrders.orderGoneMessage')}
      headline={order ? t('shopOrders.itemsCount', { count: order.items.length }) : undefined}
      headlineCaption={
        order
          ? `${t(order.fulfillment === 'delivery' ? 'shopOrders.fulfillmentDelivery' : 'shopOrders.fulfillmentPickup')} · ${t('bookings.distanceAway', { distance: formatDistance(order.distanceMeters) })}`
          : undefined
      }
      personName={order?.customerFullName}
      personLine={order?.locationAddress}
      chips={itemChips}
      details={
        order?.note ? (
          <View style={[styles.note, { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}26` }]}>
            <FontAwesome6 name="note-sticky" size={13} color={colors.primary} solid />
            <Text style={[styles.noteText, { color: colors.text }]}>{order.note}</Text>
          </View>
        ) : null
      }
      decline={{
        label: t(gone ? 'common.close' : 'shopOrders.decline'),
        icon: 'xmark',
        onPress: decline,
        loading: declineOrder.isPending,
        disabled: handingOff || declineOrder.isPending,
      }}
      accept={{
        label: t('shopOrders.openOrder'),
        icon: 'arrow-right',
        onPress: openOrder,
        loading: handingOff,
        disabled: !order || gone || declineOrder.isPending,
      }}
    />
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 14 },
  noteText: { ...typography.body, fontSize: 14, lineHeight: 20, flex: 1 },
});
