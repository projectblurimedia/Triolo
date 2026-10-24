import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { ChooseListModal } from '@/components/ChooseListModal';
import { ContinueSteps } from '@/components/ContinueSteps';
import { NearbyHero } from '@/components/NearbyHero';
import { SectionHeader } from '@/components/SectionHeader';
import { useTrustedIds } from '@/hooks/useSubscription';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { MainTabParamList } from '@/navigation/types';
import { withLocation } from '@/utils/ensureLocationOn';
import { BusinessProfileCard } from '@/components/BusinessProfileCard';
import { SHOP_CATEGORIES } from '@/constants/categories';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { locationActionLabel, useDeviceLocation } from '@/hooks/useDeviceLocation';
import { SERVICES_RADIUS_KM } from '@/hooks/useNearbyWorkers';
import { BusinessNearbyResult, businessesService } from '@/services/businessesService';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { formatDistanceValue } from '@/utils/nearbyResult';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';
import { PullToRefresh } from '@/components/PullToRefresh';
import { HomeSearchModal } from '@/components/HomeSearchModal';

const SHOP_LIMIT = 50;
// "Every shop nearby" in the single-list view (the blue card's See all).
const ALL = '__all__';
const TOP_RATED_LIMIT = 10;

/**
 * Bazaar tab — verified shops near the device, the shop-side twin of the Services tab:
 *  - one search bar; tapping it opens the search screen, where the filters live (Nearest /
 *    Top rated, Trusted, Delivery, shop type)
 *  - orders still in progress, one tap from their screen
 *  - a "Send your list" banner: pick one of your lists (or make a new one), then a shop
 *  - a Top Rated Near You row, then one row per kind of shop with "See all" (the full list)
 * Tapping a shop opens its profile (rating, reviews, favorite, "Order from this shop").
 * The account's own Business profile (if any) keeps its summary card at the top.
 */
export function BazaarScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data: businessProfile } = useMyBusinessProfile();
  const [searchVisible, setSearchVisible] = useState(false);
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [category, setCategory] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<BusinessNearbyResult | null>(null);
  // Send your list: first pick a list (or make one), then the shop.
  const [chooseListVisible, setChooseListVisible] = useState(false);
  const [sendListId, setSendListId] = useState<string | null>(null);

  const { location, refresh: refreshLocation, recheck: recheckLocation } = useDeviceLocation();
  const coords = location.status === 'ready' ? location : null;

  const shopsQuery = (shopCategory: string | null) => ({
    queryKey: ['businesses', 'nearby', 'bazaar', coords?.latitude, coords?.longitude, shopCategory],
    queryFn: () =>
      businessesService.searchNearby({
        latitude: coords!.latitude,
        longitude: coords!.longitude,
        radiusKm: SERVICES_RADIUS_KM,
        limit: SHOP_LIMIT,
        shopCategory,
      }),
    staleTime: 60_000,
  });
  // The "All" set always loads — it also drives the per-category counts on the chips.
  const allShops = useQuery({ ...shopsQuery(null), enabled: coords !== null });
  const showAll = category === ALL;
  const categoryShops = useQuery({ ...shopsQuery(category), enabled: coords !== null && category !== null && !showAll });
  const activeQuery = category && !showAll ? categoryShops : allShops;

  const trustedIds = useTrustedIds();
  const trustedNearby = useMemo(
    () => (allShops.data ?? []).filter((entry) => !!trustedIds.data?.business?.includes(entry.id)).slice(0, TOP_RATED_LIMIT),
    [allShops.data, trustedIds.data],
  );

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
    if (category && !showAll) categoryShops.refetch();
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

  const renderSectionHeader = (
    title: string,
    icon: React.ComponentProps<typeof FontAwesome6>['name'],
    options: { count?: number; onSeeAll?: () => void; tone?: 'blue' | 'gold' | 'green' } = {},
  ) => (
    <SectionHeader
      title={title}
      icon={icon}
      count={options.count}
      tone={options.tone}
      onSeeAll={options.onSeeAll}
      seeAllLabel={t('services.seeAll')}
    />
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
        t('bazaar.emptyMessage'),
      );
    }
    if (category) {
      return (
        <>
          {/* One kind of shop: say which, with the way back to all of them. */}
          <View style={[styles.categoryBar, { backgroundColor: `${colors.primary}10` }]}>
            <View style={styles.flex}>
              <Text style={[styles.categoryBarTitle, { color: colors.text }]} numberOfLines={1}>
                {showAll
                  ? t('bazaar.allShopsNearby')
                  : category
                      .split(',')
                      .map((key) => t(`businessProfile.categories.${key}`))
                      .join(', ')}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                {t('bazaar.shopsNearbyCount', { count: shops.length })}
              </Text>
            </View>
            <Pressable onPress={() => setCategory(null)} hitSlop={8} style={styles.showAll}>
              <FontAwesome6 name="xmark" size={12} color={colors.primary} solid />
              <Text style={[styles.seeAll, { color: colors.primary }]}>{t('bazaar.allShops')}</Text>
            </Pressable>
          </View>
          <View style={styles.list}>{shops.map(renderWideCard)}</View>
        </>
      );
    }
    return (
      <>
        {trustedNearby.length > 0 ? (
          <>
            {renderSectionHeader(t('trusted.label'), 'shield-halved', { tone: 'green', count: trustedNearby.length })}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {trustedNearby.map((shop) => (
                <ShopMiniCard key={shop.id} shop={shop} onPress={() => openShop(shop)} />
              ))}
            </ScrollView>
          </>
        ) : null}
        {topRated.length > 0 ? (
          <>
            {renderSectionHeader(t('bazaar.topRatedTitle'), 'star', { tone: 'gold', count: topRated.length })}
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
              {renderSectionHeader(t(`businessProfile.categories.${entry.key}`), entry.icon, {
                count: inCategory.length,
                onSeeAll: () => setCategory(entry.key),
              })}
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

  return (
    <ScreenContainer edges={['left', 'right']}>
      <PullToRefresh refreshing={activeQuery.isRefetching} onRefresh={onRefresh}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Pressable
            style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: `${colors.primary}26` }]}
            onPress={() => setSearchVisible(true)}
            accessibilityRole="search"
          >
            <FontAwesome6 name="magnifying-glass" size={15} color={colors.primary} solid />
            <Text style={[styles.searchPlaceholder, { color: colors.textMuted }]} numberOfLines={1}>
              {t('bazaar.searchPlaceholder')}
            </Text>
          </Pressable>

          <NearbyHero
            icon="store"
            title={t('bazaar.shopsNearYou')}
            subtitle={
              allShops.data && allShops.data.length > 0
                ? t('bazaar.shopsNearbyCount', { count: allShops.data.length })
                : t('bazaar.heroSubtitle')
            }
            count={allShops.data?.length ?? null}
            countCaption={t('services.heroCountCaption')}
          />


          {businessProfile ? <BusinessProfileCard profile={businessProfile} /> : null}

          {/* Lists already sent to a shop and still going (as on Home). */}
          <ContinueSteps only="orders" />



          {renderBody()}
        </ScrollView>
      </PullToRefresh>

      <NearbyResultDetailModal
        visible={selectedShop !== null}
        onClose={() => setSelectedShop(null)}
        mode="business"
        result={selectedShop}
      />
      <ChooseListModal
        visible={chooseListVisible}
        onClose={() => setChooseListVisible(false)}
        // Choosing a shop lists shops near you: location is asked for here.
        onPick={(listId) =>
          withLocation(() => {
            setChooseListVisible(false);
            setSendListId(listId);
          })
        }
        onCreate={() => {
          setChooseListVisible(false);
          navigation.navigate('PrepareList', { newList: Date.now() });
        }}
      />
      <SendListModal
        visible={sendListId !== null}
        listId={sendListId}
        onClose={() => setSendListId(null)}
        onLeave={() => setSendListId(null)}
      />
      <HomeSearchModal visible={searchVisible} onClose={() => setSearchVisible(false)} initialScope="shops" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  sectionSubtitle: { ...typography.caption, fontSize: 12, marginTop: 1 },
  categoryBar: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12, marginTop: 4 },
  categoryBarTitle: { ...typography.body, fontFamily: fonts.semiBold },
  showAll: { flexDirection: 'row', alignItems: 'center', gap: 5 },
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
