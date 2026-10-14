import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { RatingStars } from '@/components/RatingStars';
import { Avatar, WorkerMiniCard } from '@/components/WorkerMiniCard';
import { NearbyResultDetailModal } from '@/components/NearbyResultDetailModal';
import { WorkerProfileCard } from '@/components/WorkerProfileCard';
import { SKILL_CATEGORIES, WorkerProfileModal } from '@/components/WorkerProfileModal';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { locationActionLabel, useDeviceLocation } from '@/hooks/useDeviceLocation';
import { useNearbyWorkers } from '@/hooks/useNearbyWorkers';
import { NearbyWorkerSort, WorkerNearbyResult, workersService } from '@/services/workersService';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { formatDistanceValue } from '@/utils/nearbyResult';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { RouteProp, useRoute } from '@react-navigation/native';
import { MainTabParamList } from '@/navigation/types';
import { PullToRefresh } from '@/components/PullToRefresh';

const TOP_RATED_LIMIT = 10;
/**
 * Services tab — verified workers near the device, browsable by category and by rating:
 *  - category chips (All + each skill, with how many are nearby) and a Nearest / Top Rated toggle
 *  - "All": a Top Rated Near You row, then one horizontal row per category with "See all"
 *  - a single category: the full vertical list for that skill
 * Ratings come from customers confirming Your Problems jobs finished (see backend
 * migration 0016). Tapping a worker opens the shared NearbyResultDetailModal and records a
 * profile view, same as Home's Nearby Workers search. The account's own Worker profile (if
 * any) keeps its summary card at the top.
 */
export function ServicesScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data: workerProfile } = useMyWorkerProfile();
  const [editVisible, setEditVisible] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<NearbyWorkerSort>('distance');
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
    sort,
  });
  const categoryWorkers = useNearbyWorkers({
    latitude: category ? (coords?.latitude ?? null) : null,
    longitude: category ? (coords?.longitude ?? null) : null,
    skillCategory: category,
    sort,
  });

  const countsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const worker of allWorkers.data ?? []) {
      for (const skill of worker.skillCategories) counts[skill] = (counts[skill] ?? 0) + 1;
    }
    return counts;
  }, [allWorkers.data]);

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

  const activeQuery = category ? categoryWorkers : allWorkers;

  const onRefresh = () => {
    recheckLocation();
    allWorkers.refetch();
    if (category) categoryWorkers.refetch();
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
      <Avatar photoUrl={worker.portfolioPhotoUrls[0]} name={worker.accountFullName} size={56} />
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
          ? t('services.emptyCategoryMessage', { category: t(`workerProfile.skills.${category}`) })
          : t('services.emptyMessage'),
      );
    }

    if (category) {
      return <View style={styles.list}>{workers.map(renderWideCard)}</View>;
    }

    return (
      <>
        {topRated.length > 0 ? (
          <>
            {renderSectionHeader(t('services.topRatedTitle'))}
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
              {renderSectionHeader(`${t(`workerProfile.skills.${skill.key}`)} · ${inCategory.length}`, () =>
                setCategory(skill.key),
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
                {inCategory.map(renderCompactCard)}
              </ScrollView>
            </View>
          );
        })}
      </>
    );
  };

  const renderChip = (key: string | null, label: string, icon: React.ComponentProps<typeof FontAwesome6>['name']) => {
    const active = category === key;
    const count = key ? countsByCategory[key] : allWorkers.data?.length;
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
      <Pressable key={key ?? 'all'} onPress={() => setCategory(key)}>
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

  const renderSortOption = (value: NearbyWorkerSort, label: string, icon: React.ComponentProps<typeof FontAwesome6>['name']) => {
    const active = sort === value;
    return (
      <Pressable
        onPress={() => setSort(value)}
        style={[styles.sortOption, active ? { backgroundColor: colors.surface } : null]}
        accessibilityState={{ selected: active }}
      >
        <FontAwesome6 name={icon} size={11} color={active ? colors.primary : colors.textMuted} solid />
        <Text style={[styles.sortLabel, { color: active ? colors.primary : colors.textMuted }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <ScreenContainer edges={['left', 'right']}>
      <PullToRefresh refreshing={activeQuery.isRefetching} onRefresh={onRefresh}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {workerProfile ? <WorkerProfileCard profile={workerProfile} onEdit={() => setEditVisible(true)} /> : null}

          <View style={styles.titleRow}>
            <Text style={[styles.pageTitle, { color: colors.text }]}>{t('services.findWorkersTitle')}</Text>
            <View style={[styles.sortToggle, { backgroundColor: `${colors.primary}10` }]}>
              {renderSortOption('distance', t('services.sortNearest'), 'location-arrow')}
              {renderSortOption('rating', t('services.sortTopRated'), 'star')}
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {renderChip(null, t('services.allCategories'), 'border-all')}
            {SKILL_CATEGORIES.map((skill) => renderChip(skill.key, t(`workerProfile.skills.${skill.key}`), skill.icon))}
          </ScrollView>

          {renderBody()}
        </ScrollView>
      </PullToRefresh>

      <NearbyResultDetailModal
        visible={selectedWorker !== null}
        onClose={() => setSelectedWorker(null)}
        mode="worker"
        result={selectedWorker}
      />
      <WorkerProfileModal visible={editVisible} onClose={() => setEditVisible(false)} profile={workerProfile} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
