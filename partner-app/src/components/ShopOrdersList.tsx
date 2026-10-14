import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LoadingIndicator } from './LoadingIndicator';
import { useShopOrders } from '@/hooks/useShopOrders';
import { openShopOrder } from '@/state/shopOrderFocusStore';
import { ACTIVE_SHOP_STATUSES, formatRupees, NEW_ORDER_STATUSES, ShopOrder, ShopOrderStatus } from '@/services/shopOrdersService';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';
import { PullToRefresh } from './PullToRefresh';

type Tab = 'new' | 'active' | 'history';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Manual, not toLocale* — Hermes on Android doesn't reliably ship full Intl data.
function formatDate(iso: string): string {
  const date = new Date(iso);
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${date.getHours()}:${minutes}`;
}

/**
 * A shop's orders: New (waiting for Accept) / Active (packing → handover) / History, each row
 * opening the order screen (ShopOrderModal). Used by the Bookings tab and, for a shop-only
 * partner, Home. `bottomPadding` clears the floating tab bar.
 */
export function ShopOrdersList({ bottomPadding = 120 }: { bottomPadding?: number }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [tab, setTab] = useState<Tab>('new');
  const [refreshing, setRefreshing] = useState(false);
  const orders = useShopOrders(true);

  const all = orders.data ?? [];
  const lists: Record<Tab, ShopOrder[]> = {
    new: all.filter((order) => NEW_ORDER_STATUSES.includes(order.status)),
    active: all.filter((order) => ACTIVE_SHOP_STATUSES.includes(order.status)),
    history: all.filter((order) => !NEW_ORDER_STATUSES.includes(order.status) && !ACTIVE_SHOP_STATUSES.includes(order.status)),
  };

  const tone = (status: ShopOrderStatus) => {
    if (status === 'placed') return brandColors.error;
    if (status === 'completed') return brandColors.success;
    if (status === 'cancelled' || status === 'declined') return brandColors.error;
    if (status === 'expired') return brandColors.warning;
    return colors.primary;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await orders.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const renderOrder = (order: ShopOrder) => {
    const color = tone(order.status);
    return (
      <Pressable
        key={order.id}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: order.status === 'placed' ? color : colors.border }]}
        onPress={() => openShopOrder(order.id)}
      >
        <View style={[styles.icon, { backgroundColor: `${color}1A` }]}>
          <FontAwesome6 name={order.fulfillment === 'delivery' ? 'truck' : 'basket-shopping'} size={16} color={color} solid />
        </View>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {order.customerFullName}
            </Text>
            <View style={[styles.pill, { backgroundColor: `${color}1A` }]}>
              <Text style={[styles.pillText, { color }]} numberOfLines={1}>
                {t(`shopOrders.status.${order.status}.title`)}
              </Text>
            </View>
          </View>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {t('shopOrders.itemsCount', { count: order.items.length })} ·{' '}
            {t(order.fulfillment === 'delivery' ? 'shopOrders.delivery' : 'shopOrders.pickup')} · {formatDate(order.createdAt)}
          </Text>
          {order.totalAmount != null ? (
            <Text style={[styles.total, { color: colors.primary }]}>{formatRupees(order.totalAmount)}</Text>
          ) : null}
        </View>
        <FontAwesome6 name="chevron-right" size={12} color={colors.textMuted} solid />
      </Pressable>
    );
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.segment, { backgroundColor: `${colors.primary}10` }]}>
        {(['new', 'active', 'history'] as Tab[]).map((key) => {
          const active = tab === key;
          const count = key === 'history' ? 0 : lists[key].length;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.segmentItem, active ? { backgroundColor: colors.surface } : null]}
            >
              <Text style={[styles.segmentText, { color: active ? colors.primary : colors.textMuted }]}>
                {t(`shopOrders.tab.${key}`)}
              </Text>
              {count > 0 ? (
                <View style={[styles.badge, { backgroundColor: key === 'new' ? brandColors.error : colors.primary }]}>
                  <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {orders.isLoading ? (
        <View style={styles.state}>
          <LoadingIndicator color={colors.primary} />
        </View>
      ) : (
        <PullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.list, { paddingBottom: bottomPadding }]}
          >
            {lists[tab].length > 0 ? (
              lists[tab].map(renderOrder)
            ) : (
              <View style={styles.state}>
                <FontAwesome6
                  name={tab === 'new' ? 'bell' : tab === 'active' ? 'basket-shopping' : 'clock-rotate-left'}
                  size={22}
                  color={colors.textMuted}
                  solid
                />
                <Text style={[styles.stateTitle, { color: colors.text }]}>{t(`shopOrders.empty.${tab}`)}</Text>
                <Text style={[styles.meta, styles.center, { color: colors.textMuted }]}>{t('shopOrders.emptyMessage')}</Text>
              </View>
            )}
          </ScrollView>
        </PullToRefresh>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 14 },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  segmentText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontFamily: fonts.semiBold },
  list: { gap: 12, flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 12 },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { ...typography.body, fontFamily: fonts.semiBold, flex: 1 },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '55%' },
  pillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10 },
  meta: { ...typography.caption, fontSize: 12 },
  total: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 20 },
  stateTitle: { ...typography.body, fontFamily: fonts.semiBold, textAlign: 'center' },
  center: { textAlign: 'center' },
});
