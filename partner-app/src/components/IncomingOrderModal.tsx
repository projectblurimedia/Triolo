import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, Vibration, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { IncomingRequestScreen } from './IncomingRequestScreen';
import { useShopOrders } from '@/hooks/useShopOrders';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { useAuthStore } from '@/state/authStore';
import { openShopOrder, useShopOrderFocusStore } from '@/state/shopOrderFocusStore';
import { ShopOrder } from '@/services/shopOrdersService';
import { formatDistance } from '@/utils/formatDistance';
import { typography, useThemeColors } from '@/theme';

// Lets the order screen finish fading in on top before this one closes underneath it.
const MODAL_HANDOFF_MS = 350;
// A list this fresh when the app first loads still pops up (the push may have been missed).
const FRESH_ORDER_MS = 2 * 60 * 1000;
const PREVIEW_ITEMS = 4;

/**
 * The shop's "new order" takeover — the same full-screen request screen as a Quick Book job.
 * Mounted once at the app root. It opens whenever the shop's order list (polled every few
 * seconds) shows a list in `placed` that hasn't been seen yet, so it pops up over whatever
 * screen the shopkeeper is on. "Open Order" opens the order screen (accept, pack, bill);
 * "Later" just closes this — the order stays in Bookings → Orders.
 */
export function IncomingOrderModal() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { data: shop } = useMyBusinessProfile(!!accessToken);
  const { data: orders } = useShopOrders(!!shop);
  const orderScreenOpen = useShopOrderFocusStore((state) => state.orderId !== null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [handingOff, setHandingOff] = useState(false);
  const seenRef = useRef<Set<string> | null>(null);
  const lastOrderRef = useRef<ShopOrder | null>(null);

  useEffect(() => {
    if (!orders) return;
    const placed = orders.filter((order) => order.status === 'placed');
    if (seenRef.current === null) {
      seenRef.current = new Set(placed.map((order) => order.id));
      const fresh = placed.find((order) => Date.now() - new Date(order.createdAt).getTime() < FRESH_ORDER_MS);
      if (fresh) {
        setFocusedId(fresh.id);
        Vibration.vibrate([0, 400, 200, 400]);
      }
      return;
    }
    const seen = seenRef.current;
    const fresh = placed.find((order) => !seen.has(order.id));
    placed.forEach((order) => seen.add(order.id));
    // Don't pop up over the order screen itself.
    if (fresh && !focusedId && !useShopOrderFocusStore.getState().orderId) {
      setFocusedId(fresh.id);
      Vibration.vibrate([0, 400, 200, 400]);
    }
  }, [orders, focusedId]);

  const liveOrder = orders?.find((order) => order.id === focusedId) ?? null;
  if (liveOrder) lastOrderRef.current = liveOrder;
  const order = liveOrder ?? (handingOff ? lastOrderRef.current : null);
  // Accepted, cancelled or expired while this was up.
  const gone = !!focusedId && !handingOff && (!liveOrder || liveOrder.status !== 'placed');

  const close = () => setFocusedId(null);

  const openOrder = () => {
    if (!order) return;
    setHandingOff(true);
    openShopOrder(order.id);
    setTimeout(() => {
      setFocusedId(null);
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
      onRequestClose={close}
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
      decline={{ label: t(gone ? 'common.close' : 'shopOrders.later'), icon: 'clock', onPress: close, disabled: handingOff }}
      accept={{
        label: t('shopOrders.openOrder'),
        icon: 'arrow-right',
        onPress: openOrder,
        loading: handingOff,
        disabled: !order || gone,
      }}
    />
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 14 },
  noteText: { ...typography.body, fontSize: 14, lineHeight: 20, flex: 1 },
});
