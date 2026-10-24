import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { RatingStars } from '@/components/RatingStars';
import { Avatar } from '@/components/WorkerMiniCard';
import { ShopMiniCard } from '@/components/ShopMiniCard';
import { NearbyResultDetailModal } from '@/components/NearbyResultDetailModal';
import { SendListModal } from '@/components/SendListModal';
import { BusinessProfileCard } from '@/components/BusinessProfileCard';
import { SHOP_CATEGORIES } from '@/constants/categories';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { locationActionLabel, useDeviceLocation } from '@/hooks/useDeviceLocation';
import { SERVICES_RADIUS_KM } from '@/hooks/useNearbyWorkers';
import { useListStore } from '@/state/listStore';
import { BusinessNearbyResult, businessesService, NearbyShopSort } from '@/services/businessesService';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { formatDistanceValue } from '@/utils/nearbyResult';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { PullToRefresh } from '@/components/PullToRefresh';
import { HomeSearchModal } from '@/components/HomeSearchModal';
import { CategoryPicker } from '@/components/CategoryPicker';
import { DeliveryToggle } from '@/components/DeliveryToggle';

const SHOP_LIMIT = 50;
const TOP_RATED_LIMIT = 10;

/**
 * Bazaar tab — verified shops near the device, the shop-side twin of the Services tab:
 *  - a "Send your list" banner (Prepare List → a nearby shop packs it)
 *  - category chips with nearby counts, a Delivery filter, and Nearest / Top Rated
 *  - "All": a Top Rated Near You row, then one row per category with "See all";
 *    a single category: the full list
 * Tapping a shop opens its profile (rating, reviews, favorite, "Order from this shop").
 * The account's own Business profile (if any) keeps its summary card at the top.
 */
export function BazaarScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data: businessProfile } = useMyBusinessProfile();
  const [searchVisible, setSearchVisible] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [sort, setSort] = useState<NearbyShopSort>('distance');
  const [selectedShop, setSelectedShop] = useState<BusinessNearbyResult | null>(null);
  const [sendVisible, setSendVisible] = useState(false);
  const listCount = useListStore((state) => state.lists.length);

  const { location, refresh: refreshLocation, recheck: recheckLocation } = useDeviceLocation();
  const coords = location.status === 'ready' ? location : null;

  const shopsQuery = (shopCategory: string | null) => ({
    queryKey: ['businesses', 'nearby', 'bazaar', coords?.latitude, coords?.longitude, shopCategory, deliveryOnly, sort],
    queryFn: () =>
      businessesService.searchNearby({
        latitude: coords!.latitude,
        longitude: coords!.longitude,
        radiusKm: SERVICES_RADIUS_KM,
        limit: SHOP_LIMIT,
        shopCategory,
        deliveryOnly,
        sort,
      }),
    staleTime: 60_000,
  });
  // The "All" set always loads — it also drives the per-category counts on the chips.
  const allShops = useQuery({ ...shopsQuery(null), enabled: coords !== null });
  const categoryShops = useQuery({ ...shopsQuery(category), enabled: coords !== null && category !== null });
  const activeQuery = category ? categoryShops : allShops;

  const countsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const shop of allShops.data ?? []) {
      for (const key of shop.shopCategories) counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [allShops.data]);

  const topRated = useMemo(
    () =>
      (allShops.data ?? [])
        .filter((shop) => shop.ratingCount > 0)
        .sort((a, b) => (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0) || b.ratingCount - a.ratingCount)
        .slice(0, TOP_RATED_LIMIT),
    [allShops.data],
  );

  const openShop = (shop: BusinessNearbyResult) => {
    setSelectedShop(shop);
    businessesService.recordView(shop.id).catch(() => {});
  };

  const onRefresh = () => {
    recheckLocation();
    allShops.refetch();
    if (category) categoryShops.refetch();
  };

  const categoryLabel = (keys: string[]) =>
    keys
      .filter((key) => key !== 'other')
      .map((key) => t(`businessProfile.categories.${key}`))
      .join(', ');

  const renderWideCard = (shop: BusinessNearbyResult) => (
    <Pressable
      key={shop.id}
      onPress={() => openShop(shop)}
      style={[styles.wideCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Avatar
        photoUrl={shop.profilePhotoUrl}
        name={shop.shopName}
        size={56}
        seal={{ kind: 'business', id: shop.id }}
      />
      <View style={styles.wideInfo}>
        <Text style={[styles.wideName, { color: colors.text }]} numberOfLines={1}>
          {shop.shopName}
        </Text>
        <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
          {categoryLabel(shop.shopCategories)}
        </Text>
        <View style={styles.wideMetaRow}>
          <RatingStars average={shop.ratingAverage} count={shop.ratingCount} />
          <Text style={[styles.metaText, { color: shop.deliveryAvailable ? brandColors.success : colors.textMuted }]}>
            · {t(shop.deliveryAvailable ? 'sendList.delivers' : 'sendList.pickupOnly')}
          </Text>
        </View>
      </View>
      <View style={[styles.distancePill, { backgroundColor: `${colors.primary}14` }]}>
        <Text style={[styles.metaStrong, { color: colors.primary }]}>{formatDistanceValue(shop.distanceMeters)}</Text>
      </View>
    </Pressable>
  );

  const renderSectionHeader = (title: string, onSeeAll?: () => void) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={[styles.seeAll, { color: colors.primary }]}>{t('services.seeAll')}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderState = (
    icon: React.ComponentProps<typeof FontAwesome6>['name'],
    title: string,
    message: string,
    action?: { label: string; onPress: () => void },
  ) => (
    <View style={[styles.stateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <FontAwesome6 name={icon} size={24} color={colors.textMuted} solid />
      <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.stateMessage, { color: colors.textMuted }]}>{message}</Text>
      {action ? (
        <View style={styles.stateAction}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );

  const renderBody = () => {
    if (location.status === 'loading') {
      return (
        <View style={styles.loading}>
          <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
        </View>
      );
    }
    if (!coords) {
      return renderState(
        'location-crosshairs',
        t('location.disabledTitle'),
        location.status === 'denied' && !location.canAskAgain ? t('location.deniedForeverMessage') : t('bazaar.locationMessage'),
        { label: locationActionLabel(location, t), onPress: refreshLocation },
      );
    }
    if (activeQuery.isLoading) {
      return (
        <View style={styles.loading}>
          <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
        </View>
      );
    }
    if (activeQuery.isError) {
      return renderState('triangle-exclamation', t('services.loadFailedTitle'), getLocalizedErrorMessage(activeQuery.error, t), {
        label: t('common.retry'),
        onPress: () => activeQuery.refetch(),
      });
    }
    const shops = activeQuery.data ?? [];
    if (shops.length === 0) {
      return renderState(
        'store-slash',
        t('bazaar.emptyTitle'),
        deliveryOnly ? t('bazaar.emptyDeliveryMessage') : t('bazaar.emptyMessage'),
      );
    }
    if (category) {
      return <View style={styles.list}>{shops.map(renderWideCard)}</View>;
    }
    return (
      <>
        {topRated.length > 0 ? (
          <>
            {renderSectionHeader(t('bazaar.topRatedTitle'))}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {topRated.map((shop) => (
                <ShopMiniCard key={shop.id} shop={shop} onPress={() => openShop(shop)} />
              ))}
            </ScrollView>
          </>
        ) : null}
        {SHOP_CATEGORIES.map((entry) => {
          const inCategory = shops.filter((shop) => shop.shopCategories.includes(entry.key));
          if (inCategory.length === 0) return null;
          return (
            <View key={entry.key}>
              {renderSectionHeader(`${t(`businessProfile.categories.${entry.key}`)} · ${inCategory.length}`, () =>
                setCategory(entry.key),
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
                {inCategory.map((shop) => (
                  <ShopMiniCard key={shop.id} shop={shop} onPress={() => openShop(shop)} />
                ))}
              </ScrollView>
            </View>
          );
        })}
      </>
    );
  };

  const renderChip = (
    key: string,
    label: string,
    active: boolean,
    onPress: () => void,
    icon: React.ComponentProps<typeof FontAwesome6>['name'],
    count?: number,
  ) => {
    const content = (
      <>
        <FontAwesome6 name={icon} size={12} color={active ? '#FFFFFF' : colors.textMuted} solid />
        <Text style={[styles.chipLabel, { color: active ? '#FFFFFF' : colors.text }]}>{label}</Text>
        {count != null ? (
          <Text style={[styles.chipCount, { color: active ? 'rgba(255,255,255,0.85)' : colors.textMuted }]}>{count}</Text>
        ) : null}
      </>
    );
    return (
      <Pressable key={key} onPress={onPress}>
        {active ? (
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
            {content}
          </LinearGradient>
        ) : (
          <View style={[styles.chip, styles.chipInactive, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            {content}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <ScreenContainer edges={['left', 'right']}>
      <PullToRefresh refreshing={activeQuery.isRefetching} onRefresh={onRefresh}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Pressable
            style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setSearchVisible(true)}
            accessibilityRole="search"
          >
            <FontAwesome6 name="magnifying-glass" size={15} color={colors.textMuted} solid />
            <Text style={[styles.searchPlaceholder, { color: colors.textMuted }]} numberOfLines={1}>
              {t('bazaar.searchPlaceholder')}
            </Text>
          </Pressable>

          {businessProfile ? <BusinessProfileCard profile={businessProfile} /> : null}

          <Pressable onPress={() => setSendVisible(true)}>
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
              <View style={styles.bannerIcon}>
                <FontAwesome6 name="basket-shopping" size={20} color="#FFFFFF" solid />
              </View>
              <View style={styles.flex}>
                <Text style={styles.bannerTitle}>{t('bazaar.sendListTitle')}</Text>
                <Text style={styles.bannerText}>
                  {listCount > 0 ? t('bazaar.sendListReady', { count: listCount }) : t('bazaar.sendListEmpty')}
                </Text>
              </View>
              <FontAwesome6 name="chevron-right" size={13} color="#FFFFFF" solid />
            </LinearGradient>
          </Pressable>

          <View style={styles.titleRow}>
            <Text style={[styles.pageTitle, { color: colors.text }]}>{t('bazaar.shopsNearYou')}</Text>
            <View style={[styles.sortToggle, { backgroundColor: `${colors.primary}10` }]}>
              {(['distance', 'rating'] as NearbyShopSort[]).map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setSort(value)}
                  style={[styles.sortOption, sort === value ? { backgroundColor: colors.surface } : null]}
                >
                  <FontAwesome6
                    name={value === 'distance' ? 'location-arrow' : 'star'}
                    size={11}
                    color={sort === value ? colors.primary : colors.textMuted}
                    solid
                  />
                  <Text style={[styles.sortLabel, { color: sort === value ? colors.primary : colors.textMuted }]}>
                    {t(value === 'distance' ? 'services.sortNearest' : 'services.sortTopRated')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.filterRow}>
            <CategoryPicker
              title={t('bazaar.filterTitle')}
              placeholder={t('services.allCategories')}
              allLabel={t('picker.allCount', { count: allShops.data?.length ?? 0 })}
              options={SHOP_CATEGORIES.map((entry) => ({
                key: entry.key,
                label: t(`businessProfile.categories.${entry.key}`),
                icon: entry.icon,
              }))}
              selected={category ? category.split(',') : []}
              onChange={(keys) => setCategory(keys.length > 0 ? keys.join(',') : null)}
              counts={countsByCategory}
              fieldIcon="filter"
              style={styles.flex1}
            />
            <DeliveryToggle on={deliveryOnly} onPress={() => setDeliveryOnly((value) => !value)} label={t('sendList.deliveryFilter')} />
          </View>

          {renderBody()}
        </ScrollView>
      </PullToRefresh>

      <NearbyResultDetailModal
        visible={selectedShop !== null}
        onClose={() => setSelectedShop(null)}
        mode="business"
        result={selectedShop}
      />
      <SendListModal visible={sendVisible} onClose={() => setSendVisible(false)} />
      <HomeSearchModal visible={searchVisible} onClose={() => setSearchVisible(false)} initialScope="shops" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  flex1: { flex: 1 },
  // Opens the full search screen, like Home's search bar.
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 14,
  },
  searchPlaceholder: { flex: 1, fontSize: 14, fontFamily: fonts.regular },
  // Extra bottom padding clears the floating CustomTabBar.
  body: { paddingBottom: 120 },
  flex: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 16, marginBottom: 18 },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 16 },
  bannerText: { color: 'rgba(255,255,255,0.88)', fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 },
  pageTitle: { ...typography.subheading, fontFamily: fonts.semiBold, flex: 1 },
  sortToggle: { flexDirection: 'row', borderRadius: 18, padding: 3 },
  sortOption: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 15, paddingHorizontal: 10, paddingVertical: 6 },
  sortLabel: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11 },
  chipRow: { gap: 8, paddingBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  chipInactive: { borderWidth: 1 },
  chipLabel: { ...typography.caption, fontFamily: fonts.medium, fontSize: 12 },
  chipCount: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  sectionTitle: { ...typography.body, fontFamily: fonts.semiBold },
  seeAll: { ...typography.caption, fontFamily: fonts.semiBold },
  carousel: { gap: 12, paddingRight: 4 },
  metaStrong: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11 },
  metaText: { ...typography.caption, fontSize: 11 },
  list: { marginTop: 16, gap: 12 },
  wideCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 12, gap: 12 },
  wideInfo: { flex: 1, gap: 3 },
  wideName: { ...typography.body, fontFamily: fonts.semiBold },
  wideMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distancePill: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  loading: { paddingVertical: 48, alignItems: 'center' },
  stateCard: {
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  stateTitle: { ...typography.body, fontFamily: fonts.semiBold, textAlign: 'center' },
  stateMessage: { ...typography.caption, textAlign: 'center', lineHeight: 18 },
  stateAction: { alignSelf: 'stretch', marginTop: 8 },
});
