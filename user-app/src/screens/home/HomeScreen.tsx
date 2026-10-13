import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { WorkerMiniCard } from '@/components/WorkerMiniCard';
import { ShopMiniCard } from '@/components/ShopMiniCard';
import { QuickBookModal } from '@/components/QuickBookModal';
import { ProblemFormModal } from '@/components/ProblemFormModal';
import { YourProblemsModal } from '@/components/YourProblemsModal';
import { NearbySearchModal } from '@/components/NearbySearchModal';
import { HomeSearchModal } from '@/components/HomeSearchModal';
import { NearbyResultDetailModal } from '@/components/NearbyResultDetailModal';
import { SKILL_CATEGORIES } from '@/components/WorkerProfileModal';
import { locationActionLabel, useDeviceLocation } from '@/hooks/useDeviceLocation';
import { SERVICES_RADIUS_KM, useNearbyWorkers } from '@/hooks/useNearbyWorkers';
import { useNearbyBusinesses } from '@/hooks/useNearbyBusinesses';
import { useMyProblems } from '@/hooks/useProblems';
import { useMyBookings } from '@/hooks/useBookings';
import { ACTIVE_BOOKING_STATUSES } from '@/services/bookingsService';
import { openBookingTracker } from '@/state/bookingTrackerStore';
import { WorkerNearbyResult, workersService } from '@/services/workersService';
import { BusinessNearbyResult, businessesService } from '@/services/businessesService';
import { NearbySearchMode } from '@/utils/nearbyResult';
import { MainTabParamList } from '@/navigation/types';
import { useAuthStore } from '@/state/authStore';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

// Each quick action keeps its own colour, matching the Services menu drawer's palette.
const QUICK_ACTIONS: { key: 'quickBook' | 'postProblem' | 'nearbyShops' | 'prepareList'; icon: IconName; gradient: readonly [string, string] }[] = [
  { key: 'quickBook', icon: 'bolt', gradient: headerGradient },
  { key: 'postProblem', icon: 'clipboard-list', gradient: ['#7C3AED', '#A78BFA'] },
  { key: 'nearbyShops', icon: 'store', gradient: ['#16A34A', '#4ADE80'] },
  { key: 'prepareList', icon: 'list-check', gradient: ['#DB2777', '#F472B6'] },
];

const CAROUSEL_LIMIT = 10;
const ACTIVE_STATUSES = ['open', 'accepted', 'work_done'];

/**
 * Home dashboard — everything near the user at a glance, all from live data:
 *  - a search bar over BOTH workers and marketplace shops (HomeSearchModal) and a "what's
 *    near you" summary card
 *  - quick actions as a 2×2 grid of gradient cards: Quick Book, Post a Problem, Nearby
 *    Shops, Prepare List
 *  - an active Your Problems card (only when something is in progress)
 *  - Browse Services tiles (deep-link into the Services tab with that category)
 *  - Top Workers Near You and Marketplace Near You carousels, each with "See all"
 * Uses the same cached device location / nearby queries as the Services tab, so switching
 * between the two doesn't re-fetch.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const account = useAuthStore((state) => state.account);
  const firstName = account?.fullName?.split(' ')[0] ?? '';

  const [quickBookVisible, setQuickBookVisible] = useState(false);
  const [problemFormVisible, setProblemFormVisible] = useState(false);
  const [problemsVisible, setProblemsVisible] = useState(false);
  const [searchMode, setSearchMode] = useState<NearbySearchMode | null>(null);
  const [homeSearchVisible, setHomeSearchVisible] = useState(false);
  const [selected, setSelected] = useState<{ mode: NearbySearchMode; result: WorkerNearbyResult | BusinessNearbyResult } | null>(
    null,
  );

  const { location, refresh: refreshLocation, recheck: recheckLocation } = useDeviceLocation();
  const locationProblem = location.status === 'denied' || location.status === 'disabled' || location.status === 'error';
  const coords = location.status === 'ready' ? location : null;
  const workers = useNearbyWorkers({
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    skillCategory: null,
    sort: 'rating',
  });
  const shops = useNearbyBusinesses(coords?.latitude ?? null, coords?.longitude ?? null);
  const problems = useMyProblems();
  const bookings = useMyBookings();
  // The newest Quick Book booking still in progress — shown as a live card that reopens tracking.
  const liveBooking = (bookings.data ?? []).find((booking) => ACTIVE_BOOKING_STATUSES.includes(booking.status));

  const activeProblems = useMemo(
    () => (problems.data ?? []).filter((problem) => ACTIVE_STATUSES.includes(problem.status)),
    [problems.data],
  );
  const countsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const worker of workers.data ?? []) {
      for (const skill of worker.skillCategories) counts[skill] = (counts[skill] ?? 0) + 1;
    }
    return counts;
  }, [workers.data]);

  const onRefresh = () => {
    recheckLocation();
    workers.refetch();
    shops.refetch();
    problems.refetch();
    bookings.refetch();
  };

  const openWorker = (worker: WorkerNearbyResult) => {
    setSelected({ mode: 'worker', result: worker });
    workersService.recordView(worker.id).catch(() => {});
  };

  const openShop = (shop: BusinessNearbyResult) => {
    setSelected({ mode: 'business', result: shop });
    businessesService.recordView(shop.id).catch(() => {});
  };

  const handleQuickAction = (key: (typeof QUICK_ACTIONS)[number]['key']) => {
    if (key === 'quickBook') setQuickBookVisible(true);
    else if (key === 'postProblem') setProblemFormVisible(true);
    else if (key === 'nearbyShops') setSearchMode('business');
    else navigation.navigate('PrepareList');
  };

  const renderSectionHeader = (title: string, onSeeAll?: () => void) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={[styles.seeAll, { color: colors.primary }]}>{t('home.seeAll')}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderSummary = () => {
    let headline: string;
    let detail: string;
    if (location.status === 'disabled') {
      headline = t('location.disabledTitle');
      detail = t('location.disabledMessage');
    } else if (location.status === 'denied') {
      headline = t('home.locationNeededTitle');
      detail = location.canAskAgain ? t('home.locationNeededMessage') : t('location.deniedForeverMessage');
    } else if (location.status === 'error') {
      headline = t('services.locationErrorTitle');
      detail = t('services.locationErrorMessage');
    } else if (!coords || workers.isLoading || shops.isLoading) {
      headline = t('home.findingNearby');
      detail = t('home.withinRadius', { km: SERVICES_RADIUS_KM });
    } else {
      headline = t('home.nearYouSummary', { workers: workers.data?.length ?? 0, shops: shops.data?.length ?? 0 });
      detail = t('home.withinRadius', { km: SERVICES_RADIUS_KM });
    }
    return (
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summaryCard}>
        <View style={styles.summaryText}>
          <Text style={styles.summaryHeadline}>{headline}</Text>
          <Text style={styles.summaryDetail}>{detail}</Text>
        </View>
        <View style={styles.summaryIcon}>
          {!coords && location.status === 'loading' ? (
            <LoadingIndicator size={26} dotSize={4} color="#FFFFFF" />
          ) : (
            <FontAwesome6 name={coords ? 'location-dot' : 'location-crosshairs'} size={22} color="#FFFFFF" solid />
          )}
        </View>
        {locationProblem ? (
          <Pressable style={styles.summaryAction} onPress={refreshLocation}>
            <Text style={styles.summaryActionText}>{locationActionLabel(location, t)}</Text>
          </Pressable>
        ) : null}
      </LinearGradient>
    );
  };

  const latestActive = activeProblems[0];

  return (
    <ScreenContainer edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={workers.isRefetching || shops.isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Text style={[styles.greeting, { color: colors.text }]}>{t('home.greeting', { name: firstName })}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('home.subtitle')}</Text>

        <Pressable
          style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setHomeSearchVisible(true)}
          accessibilityRole="search"
        >
          <FontAwesome6 name="magnifying-glass" size={15} color={colors.textMuted} solid />
          <Text style={[styles.searchPlaceholder, { color: colors.textMuted }]} numberOfLines={1}>
            {t('home.searchPlaceholder')}
          </Text>
        </Pressable>

        {renderSummary()}

        {renderSectionHeader(t('home.quickActions'))}
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.key}
              style={({ pressed }) => [styles.actionTile, { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
              onPress={() => handleQuickAction(action.key)}
              accessibilityRole="button"
              accessibilityLabel={t(`home.action.${action.key}`)}
            >
              <LinearGradient colors={action.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionGradient}>
                {/* A large faded copy of the icon as a decorative watermark. */}
                <FontAwesome6 name={action.icon} size={72} color="rgba(255,255,255,0.16)" solid style={styles.actionWatermark} />
                <View style={styles.actionIcon}>
                  <FontAwesome6 name={action.icon} size={17} color="#FFFFFF" solid />
                </View>
                <Text style={styles.actionLabel} numberOfLines={1}>
                  {t(`home.action.${action.key}`)}
                </Text>
                <Text style={styles.actionHint} numberOfLines={1}>
                  {t(`home.actionHint.${action.key}`)}
                </Text>
              </LinearGradient>
            </Pressable>
          ))}
        </View>

        {liveBooking ? (
          <Pressable
            style={[styles.problemsCard, styles.liveCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}
            onPress={() => openBookingTracker(liveBooking.id)}
          >
            <View style={[styles.problemsIcon, { backgroundColor: colors.primary }]}>
              <FontAwesome6 name="bolt" size={17} color="#FFFFFF" solid />
            </View>
            <View style={styles.problemsInfo}>
              <Text style={[styles.problemsTitle, { color: colors.text }]}>{t(`tracking.status.${liveBooking.status}.title`)}</Text>
              <Text style={[styles.problemsDetail, { color: colors.textMuted }]} numberOfLines={1}>
                {liveBooking.worker?.fullName ? `${liveBooking.worker.fullName} · ` : ''}
                {liveBooking.skillCategories.map((key) => t(`workerProfile.skills.${key}`)).join(', ')}
              </Text>
            </View>
            <Text style={[styles.liveTrack, { color: colors.primary }]}>{t('home.trackBooking')}</Text>
          </Pressable>
        ) : null}

        {latestActive ? (
          <Pressable
            style={[styles.problemsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setProblemsVisible(true)}
          >
            <View style={[styles.problemsIcon, { backgroundColor: '#7C3AED1A' }]}>
              <FontAwesome6 name="clipboard-list" size={18} color="#7C3AED" solid />
            </View>
            <View style={styles.problemsInfo}>
              <Text style={[styles.problemsTitle, { color: colors.text }]}>
                {t('home.activeProblems', { count: activeProblems.length })}
              </Text>
              <Text style={[styles.problemsDetail, { color: colors.textMuted }]} numberOfLines={1}>
                {latestActive.skillCategories.map((key) => t(`workerProfile.skills.${key}`)).join(', ')} ·{' '}
                {t(`yourProblems.status.${latestActive.status}`)}
              </Text>
            </View>
            <FontAwesome6 name="chevron-right" size={13} color={colors.textMuted} solid />
          </Pressable>
        ) : null}

        {renderSectionHeader(t('home.browseServices'), () => navigation.navigate('Services', undefined))}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
          {SKILL_CATEGORIES.map((skill) => (
            <Pressable
              key={skill.key}
              style={[styles.categoryTile, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('Services', { category: skill.key, linkedAt: Date.now() })}
            >
              <View style={[styles.categoryIcon, { backgroundColor: `${colors.primary}14` }]}>
                <FontAwesome6 name={skill.icon} size={18} color={colors.primary} solid />
              </View>
              <Text style={[styles.categoryLabel, { color: colors.text }]} numberOfLines={1}>
                {t(`workerProfile.skills.${skill.key}`)}
              </Text>
              <Text style={[styles.categoryCount, { color: colors.textMuted }]}>
                {t('home.nearbyCount', { count: countsByCategory[skill.key] ?? 0 })}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {(workers.data ?? []).length > 0 ? (
          <>
            {renderSectionHeader(t('home.topWorkers'), () => navigation.navigate('Services', undefined))}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {(workers.data ?? []).slice(0, CAROUSEL_LIMIT).map((worker) => (
                <WorkerMiniCard key={worker.id} worker={worker} onPress={() => openWorker(worker)} />
              ))}
            </ScrollView>
          </>
        ) : null}

        {(shops.data ?? []).length > 0 ? (
          <>
            {renderSectionHeader(t('home.marketplace'), () => navigation.navigate('Bazaar'))}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {(shops.data ?? []).slice(0, CAROUSEL_LIMIT).map((shop) => (
                <ShopMiniCard key={shop.id} shop={shop} onPress={() => openShop(shop)} />
              ))}
            </ScrollView>
          </>
        ) : null}

        {coords && !workers.isLoading && !shops.isLoading && !(workers.data ?? []).length && !(shops.data ?? []).length ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FontAwesome6 name="map-location-dot" size={22} color={colors.textMuted} solid />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('home.emptyNearbyTitle')}</Text>
            <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{t('home.emptyNearbyMessage')}</Text>
          </View>
        ) : null}
      </ScrollView>

      <QuickBookModal visible={quickBookVisible} onClose={() => setQuickBookVisible(false)} />
      <ProblemFormModal visible={problemFormVisible} onClose={() => setProblemFormVisible(false)} />
      <YourProblemsModal visible={problemsVisible} onClose={() => setProblemsVisible(false)} />
      <HomeSearchModal visible={homeSearchVisible} onClose={() => setHomeSearchVisible(false)} />
      <NearbySearchModal visible={searchMode !== null} onClose={() => setSearchMode(null)} mode={searchMode ?? 'worker'} />
      <NearbyResultDetailModal
        visible={selected !== null}
        onClose={() => setSelected(null)}
        mode={selected?.mode ?? 'worker'}
        result={selected?.result ?? null}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Extra bottom padding clears the floating CustomTabBar.
  body: { paddingBottom: 120 },
  greeting: { fontSize: 22, fontFamily: fonts.semiBold, marginBottom: 4 },
  subtitle: { fontSize: 14, fontFamily: fonts.regular, marginBottom: 16 },
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
  summaryCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 18, gap: 12, flexWrap: 'wrap' },
  summaryText: { flex: 1 },
  summaryHeadline: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  summaryDetail: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', marginTop: 4 },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryAction: {
    width: '100%',
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  summaryActionText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 12 },
  sectionTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16 },
  seeAll: { ...typography.caption, fontFamily: fonts.semiBold },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Two per row: (100% - one 12px gap) / 2.
  actionTile: { width: '48.2%', borderRadius: 20, overflow: 'hidden' },
  actionGradient: { height: 112, padding: 14, justifyContent: 'flex-end' },
  actionWatermark: { position: 'absolute', right: -10, bottom: -12 },
  actionIcon: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF', fontSize: 15 },
  actionHint: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', fontSize: 11, marginTop: 2 },
  liveCard: { borderWidth: 1.5 },
  liveTrack: { ...typography.caption, fontFamily: fonts.semiBold },
  problemsCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 14 },
  problemsIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  problemsInfo: { flex: 1 },
  problemsTitle: { ...typography.body, fontFamily: fonts.semiBold },
  problemsDetail: { ...typography.caption, marginTop: 2 },
  carousel: { gap: 12, paddingRight: 4 },
  categoryTile: { width: 96, borderRadius: 16, borderWidth: 1, paddingVertical: 14, alignItems: 'center', gap: 6 },
  categoryIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  categoryCount: { ...typography.caption, fontSize: 10 },
  emptyCard: { marginTop: 22, borderRadius: 16, borderWidth: 1, paddingVertical: 26, paddingHorizontal: 20, alignItems: 'center', gap: 8 },
  emptyTitle: { ...typography.body, fontFamily: fonts.semiBold, textAlign: 'center' },
  emptyMessage: { ...typography.caption, textAlign: 'center', lineHeight: 18 },
});
