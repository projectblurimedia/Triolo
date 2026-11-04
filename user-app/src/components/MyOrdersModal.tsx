import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingIndicator } from './LoadingIndicator';
import { Avatar } from './WorkerMiniCard';
import { useMyOrders } from '@/hooks/useOrders';
import { openOrderTracker } from '@/state/orderTrackerStore';
import { CustomerOrder, formatRupees, isOrderOpen, orderStatusTitleKey, OrderStatus } from '@/services/ordersService';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { PullToRefresh } from './PullToRefresh';
import { FilterChips } from './FilterChips';
import { orderShopName } from '@/utils/orderShopName';
import { listCountText } from '@/utils/listPhotos';
import { FullText } from '@/components/FullText';

export type OrderFilter = 'active' | 'all' | 'completed' | 'notDone' | 'rated' | 'delivery' | 'pickup';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Manual, not toLocale* — Hermes on Android doesn't reliably ship full Intl data.
function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Bazaar menu → My Orders: every list sent to a shop, with filters; a row opens its order screen. */
export function MyOrdersModal({
  visible,
  onClose,
  initialFilter,
}: {
  visible: boolean;
  onClose: () => void;
  /** Which filter to open on (Profile's stat tiles); All otherwise. */
  initialFilter?: OrderFilter;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<OrderFilter>(initialFilter ?? 'all');
  useEffect(() => {
    if (visible) setFilter(initialFilter ?? 'all');
  }, [visible, initialFilter]);
  const [refreshing, setRefreshing] = useState(false);
  const orders = useMyOrders(visible);

  const all = orders.data ?? [];
  const matches = (order: CustomerOrder, key: OrderFilter): boolean => {
    switch (key) {
      case 'active':
        return isOrderOpen(order);
      case 'completed':
        return order.status === 'completed';
      case 'notDone':
        return ['cancelled', 'declined', 'expired'].includes(order.status);
      case 'rated':
        return order.shopRating != null;
      case 'delivery':
        return order.fulfillment === 'delivery';
      case 'pickup':
        return order.fulfillment !== 'delivery';
      default:
        return true;
    }
  };
  const list = all.filter((order) => matches(order, filter));
  const filterOptions = (
    [
      { key: 'all', icon: 'list', label: t('myOrders.filters.all') },
      { key: 'active', icon: 'basket-shopping', label: t('myOrders.active') },
      { key: 'completed', icon: 'bag-shopping', label: t('myOrders.filters.completed') },
      { key: 'notDone', icon: 'ban', label: t('myOrders.filters.notDone') },
      { key: 'rated', icon: 'star', label: t('myOrders.filters.rated') },
      { key: 'delivery', icon: 'truck', label: t('sendList.delivery') },
      { key: 'pickup', icon: 'store', label: t('sendList.pickup') },
    ] as const
  ).map((option) => ({ ...option, count: all.filter((order) => matches(order, option.key)).length }));

  const statusColor = (status: OrderStatus) => {
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

  const renderOrder = ({ item }: { item: CustomerOrder }) => {
    const tone = isOrderOpen(item) && item.status === 'completed' ? brandColors.warning : statusColor(item.status);
    return (
      <Pressable
        style={[
          styles.card,
          isOrderOpen(item)
            ? { backgroundColor: `${brandColors.pending}0A`, borderColor: `${brandColors.pending}99` }
            : { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onPress={() => openOrderTracker(item.id)}
      >
        <Avatar photoUrl={item.shop.photoUrl ?? undefined} name={orderShopName(item, t)} size={46} />
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <FullText style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {orderShopName(item, t)}
            </FullText>
            <View style={[styles.pill, { backgroundColor: `${tone}1A` }]}>
              <FullText style={[styles.pillText, { color: tone }]} numberOfLines={1}>
                {t(orderStatusTitleKey(item))}
              </FullText>
            </View>
          </View>
          <FullText style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {listCountText(t, item.items.length, (item.listPhotoUrls ?? []).length, item.listVoiceUrl ? (item.listVoiceSeconds ?? 0) : null)} ·{' '}
            {t(item.fulfillment === 'delivery' ? 'sendList.delivery' : 'sendList.pickup')} · {formatDate(item.createdAt)}
          </FullText>
          {item.totalAmount != null ? (
            <Text style={[styles.total, { color: colors.primary }]}>{formatRupees(item.totalAmount)}</Text>
          ) : null}
        </View>
        <FontAwesome6 name="chevron-right" size={12} color={colors.textMuted} solid />
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.close')} hitSlop={8}>
            <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.headerTitle}>{t('myOrders.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('myOrders.subtitle')}</Text>
          </View>
        </LinearGradient>

        <FilterChips options={filterOptions} value={filter} onChange={setFilter} />

        {orders.isLoading ? (
          <View style={styles.state}>
            <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
          </View>
        ) : (
          <PullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
            <FlatList
              data={list}
              keyExtractor={(item) => item.id}
              renderItem={renderOrder}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
              ListEmptyComponent={
                <View style={styles.state}>
                  <FontAwesome6 name="bag-shopping" size={24} color={colors.textMuted} solid />
                  <Text style={[styles.stateTitle, { color: colors.text }]}>
                    {t(filter === 'active' ? 'myOrders.emptyActive' : 'myOrders.filters.emptyTitle')}
                  </Text>
                  <Text style={[styles.meta, styles.center, { color: colors.textMuted }]}>{t('myOrders.emptyMessage')}</Text>
                </View>
              }
            />
          </PullToRefresh>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 16 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 18 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  // 12 between the filters and the first card, as between the cards.
  list: { padding: 16, paddingTop: 12, gap: 12, flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { ...typography.body, fontFamily: fonts.semiBold, flex: 1 },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '55%' },
  pillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10 },
  meta: { ...typography.caption, fontSize: 12 },
  total: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  stateTitle: { ...typography.body, fontFamily: fonts.semiBold, textAlign: 'center' },
  center: { textAlign: 'center' },
});
