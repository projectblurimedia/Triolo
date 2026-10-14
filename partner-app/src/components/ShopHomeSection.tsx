import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LoadingIndicator } from './LoadingIndicator';
import { useShopOrders } from '@/hooks/useShopOrders';
import { useMyShopReviews } from '@/hooks/useReviews';
import { openShopOrder } from '@/state/shopOrderFocusStore';
import { BusinessProfile } from '@/services/businessesService';
import { ACTIVE_SHOP_STATUSES, formatRupees, ShopOrder } from '@/services/shopOrdersService';
import { MainStackParamList, MainTabParamList } from '@/navigation/types';
import { formatDistance } from '@/utils/formatDistance';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

const STAR_COLOR = '#FBBF24';
const PREVIEW_LIMIT = 4;

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<MainStackParamList>
>;

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  const now = new Date();
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

/**
 * The shop on a partner's Home: the shop itself (photo, name, categories, rating, delivery —
 * tap for full details), today's numbers, and the new and in-progress orders, each opening
 * the order screen. "All orders" opens the Bookings tab on its Shop Orders side.
 */
export function ShopHomeSection({ profile }: { profile: BusinessProfile }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const navigation = useNavigation<HomeNavigation>();
  const orders = useShopOrders(true);
  const reviews = useMyShopReviews(true);

  const all = orders.data ?? [];
  const newOrders = all.filter((order) => order.status === 'placed');
  const activeOrders = all.filter((order) => ACTIVE_SHOP_STATUSES.includes(order.status));
  const completedToday = all.filter((order) => order.status === 'completed' && isToday(order.completedAt));
  const earnedToday = completedToday.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0);

  const categories = profile.shopCategories
    .filter((key) => key !== 'other')
    .map((key) => t(`businessProfile.categories.${key}`))
    .concat(profile.otherCategoryDescription ? [profile.otherCategoryDescription] : [])
    .join(', ');
  const average = reviews.data?.ratingAverage ?? null;
  const ratingCount = reviews.data?.ratingCount ?? 0;

  const openAllOrders = () => navigation.navigate('Bookings', { mode: 'orders', linkedAt: Date.now() });

  const renderStat = (icon: React.ComponentProps<typeof FontAwesome6>['name'], value: string, label: string, tone: string) => (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: `${tone}1A` }]}>
        <FontAwesome6 name={icon} size={13} color={tone} solid />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  const renderOrder = (order: ShopOrder) => {
    const isNew = order.status === 'placed';
    const tone = isNew ? brandColors.error : colors.primary;
    return (
      <Pressable
        key={order.id}
        onPress={() => openShopOrder(order.id)}
        style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: isNew ? tone : colors.border }]}
      >
        <View style={[styles.orderIcon, { backgroundColor: `${tone}1A` }]}>
          <FontAwesome6 name={order.fulfillment === 'delivery' ? 'truck' : 'basket-shopping'} size={15} color={tone} solid />
        </View>
        <View style={styles.flex}>
          <View style={styles.row}>
            <Text style={[styles.orderName, { color: colors.text }]} numberOfLines={1}>
              {order.customerFullName}
            </Text>
            <View style={[styles.pill, { backgroundColor: `${tone}1A` }]}>
              <Text style={[styles.pillText, { color: tone }]} numberOfLines={1}>
                {t(`shopOrders.status.${order.status}.title`)}
              </Text>
            </View>
          </View>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {t('shopOrders.itemsCount', { count: order.items.length })} ·{' '}
            {t(order.fulfillment === 'delivery' ? 'shopOrders.delivery' : 'shopOrders.pickup')} ·{' '}
            {formatDistance(order.distanceMeters)}
          </Text>
          {order.totalAmount != null ? (
            <Text style={[styles.total, { color: colors.primary }]}>{formatRupees(order.totalAmount)}</Text>
          ) : null}
        </View>
        <FontAwesome6 name="chevron-right" size={12} color={colors.textMuted} solid />
      </Pressable>
    );
  };

  const renderOrders = () => {
    if (orders.isLoading) {
      return (
        <View style={styles.loading}>
          <LoadingIndicator size={32} dotSize={5} color={colors.primary} />
        </View>
      );
    }
    if (newOrders.length === 0 && activeOrders.length === 0) {
      return (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome6 name="bell" size={20} color={colors.textMuted} solid />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('shopHome.noOrdersTitle')}</Text>
          <Text style={[styles.meta, styles.center, { color: colors.textMuted }]}>{t('shopHome.noOrdersMessage')}</Text>
        </View>
      );
    }
    return (
      <>
        {newOrders.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('shopHome.newOrders', { count: newOrders.length })}
            </Text>
            {newOrders.slice(0, PREVIEW_LIMIT).map(renderOrder)}
          </>
        ) : null}
        {activeOrders.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('shopHome.inProgress', { count: activeOrders.length })}
            </Text>
            {activeOrders.slice(0, PREVIEW_LIMIT).map(renderOrder)}
          </>
        ) : null}
      </>
    );
  };

  return (
    <View>
      <Pressable onPress={() => navigation.navigate('MyInfo', { capability: 'business' })}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          {profile.shopPhotoUrls[0] ? (
            <Image source={{ uri: profile.shopPhotoUrls[0] }} style={styles.heroPhoto} />
          ) : (
            <View style={[styles.heroPhoto, styles.heroPlaceholder]}>
              <FontAwesome6 name="store" size={24} color="#FFFFFF" solid />
            </View>
          )}
          <View style={styles.flex}>
            <Text style={styles.heroName} numberOfLines={1}>
              {profile.shopName}
            </Text>
            <Text style={styles.heroSub} numberOfLines={1}>
              {categories}
            </Text>
            <View style={styles.heroRow}>
              <FontAwesome6 name="star" size={11} color={STAR_COLOR} solid />
              <Text style={styles.heroMeta}>
                {average != null ? `${average.toFixed(1)} (${ratingCount})` : t('shopHome.noRatings')}
              </Text>
              <Text style={styles.heroMeta}>·</Text>
              <FontAwesome6 name={profile.deliveryAvailable ? 'truck' : 'store'} size={11} color="#FFFFFF" solid />
              <Text style={styles.heroMeta} numberOfLines={1}>
                {profile.deliveryAvailable
                  ? t('shopHome.delivers', { price: profile.deliveryPricePerKm ?? 0 })
                  : t('shopHome.pickupOnly')}
              </Text>
            </View>
          </View>
          <View style={styles.heroChevron}>
            <FontAwesome6 name="chevron-right" size={12} color="#FFFFFF" solid />
          </View>
        </LinearGradient>
      </Pressable>

      <View style={styles.stats}>
        {renderStat('bell', String(newOrders.length), t('shopHome.statNew'), brandColors.error)}
        {renderStat('basket-shopping', String(activeOrders.length), t('shopHome.statActive'), colors.primary)}
        {renderStat('indian-rupee-sign', formatRupees(earnedToday), t('shopHome.statToday'), brandColors.success)}
      </View>

      {renderOrders()}

      <Pressable style={[styles.allButton, { borderColor: colors.primary }]} onPress={openAllOrders}>
        <FontAwesome6 name="list" size={13} color={colors.primary} solid />
        <Text style={[styles.allText, { color: colors.primary }]}>{t('shopHome.allOrders')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  center: { textAlign: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 16 },
  heroPhoto: { width: 58, height: 58, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  heroPlaceholder: { backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroName: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 18 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  heroMeta: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 12, flexShrink: 1 },
  heroChevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', gap: 10, marginTop: 16 },
  stat: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 12, alignItems: 'flex-start', gap: 4 },
  statIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22 },
  statLabel: { ...typography.caption, fontSize: 11 },
  sectionTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginTop: 22, marginBottom: 12 },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  orderIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  orderName: { ...typography.body, fontFamily: fonts.semiBold, flex: 1 },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '50%' },
  pillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10 },
  meta: { ...typography.caption, fontSize: 12 },
  total: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  loading: { paddingVertical: 28, alignItems: 'center' },
  empty: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', gap: 8, marginTop: 22 },
  emptyTitle: { ...typography.body, fontFamily: fonts.semiBold },
  allButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    height: 46,
    marginTop: 14,
  },
  allText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
});
