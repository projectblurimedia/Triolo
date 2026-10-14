import React, { useState } from 'react';
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

type Tab = 'active' | 'history';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Manual, not toLocale* — Hermes on Android doesn't reliably ship full Intl data.
function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Bazaar menu → My Orders: every list sent to a shop, Active / History; a row opens its order screen. */
export function MyOrdersModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('active');
  const [refreshing, setRefreshing] = useState(false);
  const orders = useMyOrders(visible);

  const all = orders.data ?? [];
  const active = all.filter(isOrderOpen);
  const history = all.filter((order) => !isOrderOpen(order));
  const list = tab === 'active' ? active : history;

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
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => openOrderTracker(item.id)}
      >
        <Avatar photoUrl={item.shop.photoUrl ?? undefined} name={item.shop.name} size={46} />
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {item.shop.name}
            </Text>
            <View style={[styles.pill, { backgroundColor: `${tone}1A` }]}>
              <Text style={[styles.pillText, { color: tone }]} numberOfLines={1}>
                {t(orderStatusTitleKey(item))}
              </Text>
            </View>
          </View>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {t('orders.itemsCount', { count: item.items.length })} ·{' '}
            {t(item.fulfillment === 'delivery' ? 'sendList.delivery' : 'sendList.pickup')} · {formatDate(item.createdAt)}
          </Text>
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

        <View style={[styles.segment, { backgroundColor: `${colors.primary}10` }]}>
          {(['active', 'history'] as Tab[]).map((key) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.segmentItem, tab === key ? { backgroundColor: colors.surface } : null]}
            >
              <Text style={[styles.segmentText, { color: tab === key ? colors.primary : colors.textMuted }]}>
                {t(key === 'active' ? 'myOrders.active' : 'myOrders.history')}
                {key === 'active' && active.length > 0 ? ` · ${active.length}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>

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
                    {t(tab === 'active' ? 'myOrders.emptyActive' : 'myOrders.emptyHistory')}
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
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, margin: 16, marginBottom: 6 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11 },
  segmentText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
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
