import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { RatingStars } from '@/components/RatingStars';
import { Avatar, WorkerMiniCard } from '@/components/WorkerMiniCard';
import { NearbyResultDetailModal } from '@/components/NearbyResultDetailModal';
import { WorkerProfileCard } from '@/components/WorkerProfileCard';
import { SKILL_CATEGORIES } from '@/constants/categories';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { locationActionLabel, useDeviceLocation } from '@/hooks/useDeviceLocation';
import { useNearbyWorkers } from '@/hooks/useNearbyWorkers';
import { WorkerNearbyResult, workersService } from '@/services/workersService';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { formatDistanceValue } from '@/utils/nearbyResult';
import { fonts, typography, useThemeColors } from '@/theme';
import { RouteProp, useRoute } from '@react-navigation/native';
import { MainTabParamList } from '@/navigation/types';
import { PullToRefresh } from '@/components/PullToRefresh';
import { HomeSearchModal } from '@/components/HomeSearchModal';
import { ContinueSteps } from '@/components/ContinueSteps';
import { NearbyHero } from '@/components/NearbyHero';
import { SectionHeader } from '@/components/SectionHeader';
import { useTrustedIds } from '@/hooks/useSubscription';

const TOP_RATED_LIMIT = 10;
// "Every worker nearby" in the single-list view (the blue card's See all).
const ALL = '__all__';
/**
 * Services tab — verified workers near the device:
 *  - one search bar; tapping it opens the search screen, where the filters live (Nearest /
 *    Top rated, Trusted, kind of work)
 *  - bookings still in progress, one tap from their screen
 *  - a Top Rated Near You row, then one row per kind of work with "See all" (the full list)
 * Ratings come from customers confirming Your Problems jobs finished (see backend
 * migration 0016). Tapping a worker opens the shared NearbyResultDetailModal and records a
 * profile view, same as Home's Nearby Workers search. The account's own Worker profile (if
 * any) keeps its summary card at the top.
 */
export function ServicesScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data: workerProfile } = useMyWorkerProfile();
  const [searchVisible, setSearchVisible] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<WorkerNearbyResult | null>(null);
  const route = useRoute<RouteProp<MainTabParamList, 'Services'>>();
  const linkedCategory = route.params?.category;
  const linkedAt = route.params?.linkedAt;

  // Home's Browse Services tiles link here with a category — preselect its chip. `linkedAt`
  // changes on every tap, so tapping the same tile again re-applies it even if the user
  // switched chips in between.
  useEffect(() => {
    if (linkedCategory) setCategory(linkedCategory);
  }, [linkedCategory, linkedAt]);

  const { location, refresh: refreshLocation, recheck: recheckLocation } = useDeviceLocation();
  const coords = location.status === 'ready' ? location : null;
  // The "All" result set always loads — it drives the per-category counts on the chips too.
  const allWorkers = useNearbyWorkers({
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    skillCategory: null,
    sort: 'distance',
  });
  const showAll = category === ALL;
  const categoryWorkers = useNearbyWorkers({
    latitude: category && !showAll ? (coords?.latitude ?? null) : null,
    longitude: category && !showAll ? (coords?.longitude ?? null) : null,
    skillCategory: category,
    sort: 'distance',
  });

  const trustedIds = useTrustedIds();
  const trustedNearby = useMemo(
    () => (allWorkers.data ?? []).filter((entry) => !!trustedIds.data?.service?.includes(entry.id)).slice(0, TOP_RATED_LIMIT),
    [allWorkers.data, trustedIds.data],
  );

  const topRated = useMemo(
    () =>
      (allWorkers.data ?? [])
        .filter((worker) => worker.ratingCount > 0)
        .sort((a, b) => (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0) || b.ratingCount - a.ratingCount)
        .slice(0, TOP_RATED_LIMIT),
    [allWorkers.data],
  );

  const openWorker = (worker: WorkerNearbyResult) => {
    setSelectedWorker(worker);
    // Fire-and-forget, same as NearbySearchModal — a failed notification must never block viewing.
    workersService.recordView(worker.id).catch(() => {});
  };

  const skillLabel = (keys: string[]) =>
    keys
      .filter((key) => key !== 'other')
      .map((key) => t(`workerProfile.skills.${key}`))
      .join(', ');

  const activeQuery = category && !showAll ? categoryWorkers : allWorkers;

  const onRefresh = () => {
    recheckLocation();
    allWorkers.refetch();
    if (category && !showAll) categoryWorkers.refetch();
  };

  const renderCompactCard = (worker: WorkerNearbyResult) => (
    <WorkerMiniCard key={worker.id} worker={worker} onPress={() => openWorker(worker)} />
  );

  const renderWideCard = (worker: WorkerNearbyResult) => (
    <Pressable
      key={worker.id}
      onPress={() => openWorker(worker)}
      style={[styles.wideCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Avatar
        photoUrl={worker.profilePhotoUrl}
        name={worker.accountFullName}
        size={56}
        seal={{ kind: 'service', id: worker.id }}
      />
      <View style={styles.wideInfo}>
        <Text style={[styles.wideName, { color: colors.text }]} numberOfLines={1}>
          {worker.accountFullName}
        </Text>
        <Text style={[styles.compactSkills, { color: colors.textMuted }]} numberOfLines={1}>
          {skillLabel(worker.skillCategories)}
        </Text>
        <View style={styles.wideMetaRow}>
          <RatingStars average={worker.ratingAverage} count={worker.ratingCount} />
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            · {t('services.experienceShort', { count: worker.experienceYears })}
          </Text>
        </View>
      </View>
      <View style={[styles.distancePill, { backgroundColor: `${colors.primary}14` }]}>
        <Text style={[styles.metaStrong, { color: colors.primary }]}>{formatDistanceValue(worker.distanceMeters)}</Text>
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

  const renderLoading = (label: string) => (
    <View style={styles.loading}>
      <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
      <Text style={[styles.metaText, styles.loadingText, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );

  const renderBody = () => {
    if (location.status === 'loading') return renderLoading(t('services.locating'));
    if (location.status === 'denied' || location.status === 'disabled' || location.status === 'error') {
      const title =
        location.status === 'disabled'
          ? t('location.disabledTitle')
          : location.status === 'denied'
            ? t('services.locationDeniedTitle')
            : t('services.locationErrorTitle');
      const message =
        location.status === 'disabled'
          ? t('location.disabledMessage')
          : location.status === 'denied'
            ? location.canAskAgain
              ? t('services.locationDeniedMessage')
              : t('location.deniedForeverMessage')
            : t('services.locationErrorMessage');
      return renderState('location-crosshairs', title, message, {
        label: locationActionLabel(location, t),
        onPress: refreshLocation,
      });
    }
    if (activeQuery.isLoading) return renderLoading(t('services.searching'));
    if (activeQuery.isError) {
      return renderState('triangle-exclamation', t('services.loadFailedTitle'), getLocalizedErrorMessage(activeQuery.error, t), {
        label: t('common.retry'),
        onPress: () => activeQuery.refetch(),
      });
    }

    const workers = activeQuery.data ?? [];
    if (workers.length === 0) {
      return renderState(
        'user-slash',
        t('services.emptyTitle'),
        category
          ? t('services.emptyCategoryMessage', {
              category: category
                .split(',')
                .map((key) => t(`workerProfile.skills.${key}`))
                .join(', '),
            })
          : t('services.emptyMessage'),
      );
    }

    if (category) {
      return (
        <>
          {/* One kind of work: say which, with the way back to everyone. */}
          <View style={[styles.categoryBar, { backgroundColor: `${colors.primary}10` }]}>
            <View style={styles.flex}>
              <Text style={[styles.categoryBarTitle, { color: colors.text }]} numberOfLines={1}>
                {showAll
                  ? t('services.allWorkersNearby')
                  : category
                      .split(',')
                      .map((key) => t(`workerProfile.skills.${key}`))
                      .join(', ')}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                {t('services.workersNearbyCount', { count: workers.length })}
              </Text>
            </View>
            <Pressable onPress={() => setCategory(null)} hitSlop={8} style={styles.showAll}>
              <FontAwesome6 name="xmark" size={12} color={colors.primary} solid />
              <Text style={[styles.seeAll, { color: colors.primary }]}>{t('services.allWorkers')}</Text>
            </Pressable>
          </View>
          <View style={styles.list}>{workers.map(renderWideCard)}</View>
        </>
      );
    }

    return (
      <>
        {trustedNearby.length > 0 ? (
          <>
            {renderSectionHeader(t('trusted.label'), 'shield-halved', { tone: 'green', count: trustedNearby.length })}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {trustedNearby.map(renderCompactCard)}
            </ScrollView>
          </>
        ) : null}

        {topRated.length > 0 ? (
          <>
            {renderSectionHeader(t('services.topRatedTitle'), 'star', { tone: 'gold', count: topRated.length })}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {topRated.map(renderCompactCard)}
            </ScrollView>
          </>
        ) : null}

        {SKILL_CATEGORIES.map((skill) => {
          const inCategory = workers.filter((worker) => worker.skillCategories.includes(skill.key));
          if (inCategory.length === 0) return null;
          return (
            <View key={skill.key}>
              {renderSectionHeader(t(`workerProfile.skills.${skill.key}`), skill.icon, {
                count: inCategory.length,
                onSeeAll: () => setCategory(skill.key),
              })}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
                {inCategory.map(renderCompactCard)}
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
              {t('services.searchPlaceholder')}
            </Text>
          </Pressable>

          <NearbyHero
            icon="screwdriver-wrench"
            title={t('services.findWorkersTitle')}
            subtitle={
              allWorkers.data && allWorkers.data.length > 0
                ? t('services.workersNearbyCount', { count: allWorkers.data.length })
                : t('services.heroSubtitle')
            }
            count={allWorkers.data?.length ?? null}
            countCaption={t('services.heroCountCaption')}
          />


          {workerProfile ? <WorkerProfileCard profile={workerProfile} /> : null}

          {/* Bookings still going (as on Home). */}
          <ContinueSteps only="bookings" />


          {renderBody()}
        </ScrollView>
      </PullToRefresh>

      <NearbyResultDetailModal
        visible={selectedWorker !== null}
        onClose={() => setSelectedWorker(null)}
        mode="worker"
        result={selectedWorker}
      />
      <HomeSearchModal visible={searchVisible} onClose={() => setSearchVisible(false)} initialScope="workers" />
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
  flex: { flex: 1 },
  seeAll: { ...typography.caption, fontFamily: fonts.semiBold },
  carousel: { gap: 12, paddingRight: 4 },
  compactSkills: { ...typography.caption, fontSize: 11, textAlign: 'center' },
  metaStrong: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11 },
  metaText: { ...typography.caption, fontSize: 11 },
  list: { marginTop: 16, gap: 12 },
  wideCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 12, gap: 12 },
  wideInfo: { flex: 1, gap: 3 },
  wideName: { ...typography.body, fontFamily: fonts.semiBold },
  wideMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distancePill: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  loading: { paddingVertical: 48, alignItems: 'center' },
  loadingText: { marginTop: 12 },
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
