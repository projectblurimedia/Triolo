import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Button } from './Button';
import { CategoryPicker } from './CategoryPicker';
import { LoadingIndicator } from './LoadingIndicator';
import { PullToRefresh } from './PullToRefresh';
import { ToastHost } from './ToastHost';
import { Avatar } from './WorkerMiniCard';
import { JobSeekerDetailModal, jobSeekerTitle } from './JobSeekerDetailModal';
import { locationActionLabel, useDeviceLocation } from '@/hooks/useDeviceLocation';
import { SERVICES_RADIUS_KM } from '@/hooks/useNearbyWorkers';
import {
  JOB_CATEGORIES,
  JobCategory,
  JobSeeker,
  jobSeekersService,
  JobSeekerSort,
  PayPeriod,
} from '@/services/jobSeekersService';
import { formatRupees } from '@/services/ordersService';
import { formatDistanceValue } from '@/utils/nearbyResult';
import { callStaff } from '@/utils/callStaff';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { askForLocation } from '@/utils/ensureLocationOn';
import { useAdGate } from './Ads';
import { placeName } from '@/utils/formatAddress';
import { useTrustedIds } from '@/hooks/useSubscription';
import { HighlightText } from './HighlightText';
import { SectionHeader } from './SectionHeader';

const CALL_GRADIENT = ['#16A34A', '#22C55E'] as const;
// Tile colours on the intro, one per kind of work in turn (no orange — that's the shop colour).
const TILE_COLORS = ['#0055D3', '#0D9488', '#7C3AED', '#16A34A', '#DB2777', '#2563EB'];

interface HireStaffModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * "Hire Staff": people nearby looking for regular work — a home cook, a tutor, a driver, a
 * nanny… (posted from the partner app). Filter by kind of work and daily / monthly pay, sort
 * nearest or lowest pay, search by name / work / skill, and call them straight away.
 *
 * It opens on an intro (the kinds of work, how it works) with no filter selected and nobody
 * listed. The first search or filter asks for location, shows a local business's ad (when one is
 * running), and then lists the people near you.
 */
export function HireStaffModal({ visible, onClose }: HireStaffModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { location, refresh: refreshLocation } = useDeviceLocation();
  const coords = location.status === 'ready' ? location : null;

  const [category, setCategory] = useState<JobCategory | null>(null);
  const [payPeriod, setPayPeriod] = useState<PayPeriod | null>(null);
  const [nearest, setNearest] = useState(true);
  const [lowestPay, setLowestPay] = useState(false);
  const sort: JobSeekerSort = lowestPay ? 'pay' : 'distance';
  const [trustedOnly, setTrustedOnly] = useState(false);
  const trusted = useTrustedIds();
  const [query, setQuery] = useState('');
  // The search that's run: set when the search icon or the keyboard's search key is pressed.
  const [appliedQuery, setAppliedQuery] = useState('');
  const [selected, setSelected] = useState<JobSeeker | null>(null);
  // Whether people are listed yet (after the first search / filter), and whether that's starting.
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const { waitForAd } = useAdGate(visible, 'hire_staff');

  // Every opening starts fresh and goes straight to the people nearby, grouped by work.
  useEffect(() => {
    if (!visible) return;
    setStarted(false);
    startingRef.current = false;
    setTimeout(() => begin(), 0);
    setCategory(null);
    setPayPeriod(null);
    setNearest(true);
    setLowestPay(false);
    setTrustedOnly(false);
    setQuery('');
    setAppliedQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /** Location first, then the ad, then the list. */
  const begin = async () => {
    // Only one start at a time (the opening calls it before the reset state has re-rendered).
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      // Spins from the tap: the location check can take a moment, then the ad.
      setStarting(true);
      if (!(await askForLocation())) return;
      if (!(await waitForAd())) return;
      setStarted(true);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  /** A filter change — on the intro it also starts the search. */
  const pick = (change: () => void) => {
    change();
    if (!started) begin();
  };

  // The kinds of work, for the dropdowns (A–Z inside the picker).
  const workOptions = JOB_CATEGORIES.filter((entry) => entry.key !== 'other').map((entry) => ({
    key: entry.key,
    label: t(`hireStaff.categories.${entry.key}`),
    icon: entry.icon,
  }));

  /** A kind of work from the dropdown: a listed one filters by it, anything else (typed by someone) searches by name. */
  const chooseWork = (key?: string) => {
    if (!key) {
      // Cleared: back to everyone nearby, grouped by work.
      setCategory(null);
      setQuery('');
      setAppliedQuery('');
      return;
    }
    if (JOB_CATEGORIES.some((entry) => entry.key === key)) {
      setQuery('');
      setAppliedQuery('');
      pick(() => setCategory(key as JobCategory));
    } else {
      setQuery(key);
      setAppliedQuery(key);
      pick(() => setCategory(null));
    }
  };

  /** Runs the typed search (the first one also asks for location and shows the ad). */
  const submitSearch = () => {
    setAppliedQuery(query.trim());
    if (!started) begin();
  };

  const results = useQuery({
    queryKey: ['job-seekers', coords?.latitude, coords?.longitude, category, payPeriod, sort, appliedQuery],
    queryFn: () =>
      jobSeekersService.search({
        latitude: coords!.latitude,
        longitude: coords!.longitude,
        radiusKm: SERVICES_RADIUS_KM,
        category,
        payPeriod,
        query: appliedQuery || undefined,
        sort,
      }),
    enabled: visible && started && coords !== null,
    staleTime: 30_000,
  });

  const chip = (key: string, label: string, active: boolean, onPress: () => void, icon?: string) => (
    <Pressable key={key} onPress={onPress}>
      {active ? (
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
          {icon ? <FontAwesome6 name={icon as never} size={11} color="#FFFFFF" solid /> : null}
          <Text style={[styles.chipText, { color: '#FFFFFF' }]}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.chip, { borderWidth: 1, borderColor: `${colors.primary}26`, backgroundColor: colors.surface }]}>
          {icon ? <FontAwesome6 name={icon as never} size={11} color={colors.primary} solid /> : null}
          <Text style={[styles.chipText, { color: colors.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );

  const renderPerson = ({ item }: { item: JobSeeker }, compact = false) => {
    const categoryIcon = JOB_CATEGORIES.find((entry) => entry.key === item.category)?.icon ?? 'user-tie';
    const place = placeName(item.locationAddress);
    const term = appliedQuery;
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.surface, borderColor: `${colors.primary}1F`, opacity: pressed ? 0.92 : 1 },
        ]}
        onPress={() => setSelected(item)}
      >
        <View style={styles.cardTop}>
          <Avatar photoUrl={item.photoUrl ?? undefined} name={item.fullName} size={compact ? 42 : 54} seal={{ kind: 'job_post', id: item.id }} />
          <View style={styles.flex}>
            <HighlightText text={item.fullName} term={term} style={[styles.name, { color: colors.text }]} numberOfLines={1} />
            <View style={styles.workRow}>
              <FontAwesome6 name={categoryIcon as never} size={11} color={colors.primary} solid />
              <HighlightText text={jobSeekerTitle(item, t)} term={term} style={[styles.jobTitle, { color: colors.primary }]} numberOfLines={1} />
            </View>
          </View>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.distancePill}>
            <FontAwesome6 name="location-arrow" size={10} color="#FFFFFF" solid />
            <Text style={[styles.distanceText, { color: '#FFFFFF' }]}>{formatDistanceValue(item.distanceMeters)}</Text>
          </LinearGradient>
        </View>

        {/* Pay, how often, and experience at a glance. */}
        <View style={[styles.factsRow, { backgroundColor: colors.background, borderColor: `${colors.primary}14` }]}>
          <View style={styles.fact}>
            <Text style={[styles.pay, { color: colors.text }]}>{formatRupees(item.payAmount)}</Text>
            <Text style={[styles.factLabel, { color: colors.textMuted }]}>{t(`hireStaff.per.${item.payPeriod}`)}</Text>
          </View>
          <View style={[styles.factDivider, { backgroundColor: `${colors.primary}1F` }]} />
          <View style={styles.fact}>
            <Text style={[styles.factValue, { color: brandColors.success }]} numberOfLines={1}>
              {t(`hireStaff.availability.${item.availability}`)}
            </Text>
            <Text style={[styles.factLabel, { color: colors.textMuted }]}>{t('hireStaff.availabilityLabel')}</Text>
          </View>
          <View style={[styles.factDivider, { backgroundColor: `${colors.primary}1F` }]} />
          <View style={styles.fact}>
            <Text style={[styles.factValue, { color: colors.text }]} numberOfLines={1}>
              {item.experienceYears > 0 ? t('hireStaff.years', { count: item.experienceYears }) : t('hireStaff.fresher')}
            </Text>
            <Text style={[styles.factLabel, { color: colors.textMuted }]}>{t('hireStaff.experienceLabel')}</Text>
          </View>
        </View>

        {/* One row: the first skill, the place, and Call. */}
        <View style={[styles.contactRow, { borderTopColor: `${colors.primary}14` }]}>
          {/* The skill and the place: the same pill, so always the same height. The pill never
              shrinks; only its text is capped (a shrinking text inside a shrinking row can
              collapse to nothing on Android, which hid the skill). */}
          <View style={styles.pillsRow}>
          {item.skills.length > 0 ? (
            <View style={[styles.pill, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}40` }]}>
              <FontAwesome6 name={categoryIcon as never} size={10} color={colors.primary} solid />
              <HighlightText
                text={item.skills.length > 1 ? `${item.skills[0]} +${item.skills.length - 1}` : item.skills[0]}
                term={term}
                style={[styles.pillText, { color: colors.primary }]}
                numberOfLines={1}
              />
            </View>
          ) : null}
          <View style={[styles.pill, { backgroundColor: colors.text, borderColor: colors.text }]}>
            <FontAwesome6 name="location-dot" size={10} color={colors.background} solid />
            <Text style={[styles.pillText, { color: colors.background }]} numberOfLines={1}>
              {place || t('hireStaff.nearYou')}
            </Text>
          </View>
          </View>
          <Pressable onPress={() => callStaff(item, () => results.refetch())} accessibilityLabel={`${t('hireStaff.call')} ${item.fullName}`}>
            <LinearGradient colors={CALL_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.callButton}>
              <FontAwesome6 name="phone" size={12} color="#FFFFFF" solid />
              <Text style={styles.callText}>{t('hireStaff.call')}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const renderIntro = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.intro, { paddingBottom: insets.bottom + 28 }]}
    >
      <Text style={[styles.introHeading, { color: colors.text }]}>{t('hireStaff.howTitle')}</Text>
      <View style={[styles.howCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(
          [
            ['magnifying-glass', 'hireStaff.how1'],
            ['id-card', 'hireStaff.how2'],
            ['phone', 'hireStaff.how3'],
          ] as const
        ).map(([icon, key], index) => (
          <View key={key} style={styles.howRow}>
            <View style={[styles.howIcon, { backgroundColor: `${colors.primary}12` }]}>
              <FontAwesome6 name={icon} size={14} color={colors.primary} solid />
            </View>
            <Text style={[styles.howText, { color: colors.text }]}>
              <Text style={{ color: colors.primary, fontFamily: fonts.semiBold }}>{index + 1}. </Text>
              {t(key)}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.note}>
        <FontAwesome6 name="shield-halved" size={12} color={colors.textMuted} solid />
        <Text style={[styles.noteText, { color: colors.textMuted }]}>{t('hireStaff.introNote')}</Text>
      </View>
    </ScrollView>
  );

  type ListRow = { key: string; person: JobSeeker } | { key: string; group: { key: string; title: string; icon: string; people: JobSeeker[] } };
  const people = (results.data ?? [])
    .filter((person) => !trustedOnly || !!trusted.data?.job_post?.includes(person.id))
    .sort((a, b) =>
      lowestPay && nearest
        ? a.payAmount - b.payAmount || a.distanceMeters - b.distanceMeters
        : lowestPay
          ? a.payAmount - b.payAmount
          : a.distanceMeters - b.distanceMeters,
    );
  // Nothing picked or searched: everyone nearby in rows by kind of work (like Services / Bazaar).
  const browsing = !category && !appliedQuery;
  const groups = browsing
    ? [
        ...JOB_CATEGORIES.filter((entry) => entry.key !== 'other').map((entry) => ({
          key: entry.key,
          title: t(`hireStaff.categories.${entry.key}`),
          icon: entry.icon as string,
          people: people.filter((person) => person.category === entry.key),
        })),
        // Work people typed themselves, one row per title.
        ...Array.from(new Set(people.filter((p) => p.category === 'other').map((p) => p.title))).map((title) => ({
          key: `other-${title}`,
          title,
          icon: 'user-tie',
          people: people.filter((person) => person.category === 'other' && person.title === title),
        })),
      ].filter((group) => group.people.length > 0)
    : [];
  const listRows: ListRow[] = browsing
    ? groups.map((group) => ({ key: group.key, group }))
    : people.map((person) => ({ key: person.id, person }));

  const renderRow = ({ item: row }: { item: ListRow }) => {
    if ('person' in row) return renderPerson({ item: row.person });
    const { group } = row;
    return (
      <View>
        <SectionHeader
          title={group.title}
          icon={group.icon as React.ComponentProps<typeof FontAwesome6>['name']}
          count={group.people.length}
          style={styles.groupHeader}
          seeAllLabel={t('services.seeAll')}
          onSeeAll={() =>
            JOB_CATEGORIES.some((entry) => entry.key === group.key) ? chooseWork(group.key) : chooseWork(group.title)
          }
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
          {group.people.map((person) => (
            <View key={person.id} style={styles.carouselCard}>
              {renderPerson({ item: person }, true)}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderBody = () => {
    if (starting) {
      return (
        <View style={styles.state}>
          <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
          <Text style={[styles.stateText, { color: colors.textMuted }]}>{t('hireStaff.finding')}</Text>
        </View>
      );
    }
    if (!started) return renderIntro();
    if (!coords) {
      const blocked = location.status === 'denied' || location.status === 'disabled' || location.status === 'error';
      return (
        <View style={styles.state}>
          {blocked ? (
            <>
              <FontAwesome6 name="location-crosshairs" size={24} color={colors.textMuted} solid />
              <Text style={[styles.stateTitle, { color: colors.text }]}>{t('location.disabledTitle')}</Text>
              <View style={styles.stateAction}>
                <Button label={locationActionLabel(location, t)} onPress={refreshLocation} />
              </View>
            </>
          ) : (
            <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
          )}
        </View>
      );
    }
    if (results.isLoading) {
      return (
        <View style={styles.state}>
          <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
        </View>
      );
    }
    return (
      // A new search / filter gets a fresh list, placed past the pull-to-refresh room from the start.
      <PullToRefresh
        key={JSON.stringify([category, payPeriod, appliedQuery, trustedOnly, nearest, lowestPay])}
        refreshing={results.isRefetching}
        onRefresh={() => results.refetch()}
      >
        <FlatList<ListRow>
          data={listRows}
          keyExtractor={(row) => row.key}
          renderItem={renderRow}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={
            <View style={styles.state}>
              <FontAwesome6
                name={results.isError ? 'triangle-exclamation' : 'user-slash'}
                size={24}
                color={colors.textMuted}
                solid
              />
              <Text style={[styles.stateTitle, { color: colors.text }]}>
                {t(results.isError ? 'hireStaff.loadFailed' : 'hireStaff.emptyTitle')}
              </Text>
              {results.isError ? null : (
                <Text style={[styles.stateText, { color: colors.textMuted }]}>{t('hireStaff.emptyMessage')}</Text>
              )}
            </View>
          }
        />
      </PullToRefresh>
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
            <Text style={styles.headerTitle}>{t('hireStaff.title')}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {t('hireStaff.subtitle')}
            </Text>
          </View>
        </LinearGradient>

        {/* Search and filters in one card under the header (headers carry only the title). */}
        <View style={[styles.filterCard, { backgroundColor: colors.background, borderColor: `${colors.primary}1F` }]}>
          {/* What kind of work: one searchable dropdown (it also finds work people typed themselves). */}
          <CategoryPicker
            title={t('hireStaff.chooseType')}
            placeholder={t('hireStaff.selectType')}
            options={workOptions}
            selected={category ? [category] : appliedQuery ? [appliedQuery] : []}
            onChange={([key]) => chooseWork(key)}
            single
            searchCustom={jobSeekersService.customTitles}
            customIcon="user-tie"
            fieldIcon="user-tie"
            clearable
          />
          {/* Pay: one choice of three (a radio). */}
          <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: `${colors.primary}26` }]}>
            {([null, 'daily', 'monthly'] as (PayPeriod | null)[]).map((value) => {
              const active = payPeriod === value;
              const label = value ? t(`hireStaff.period.${value}`) : t('hireStaff.anyPay');
              return (
                <Pressable key={value ?? 'any'} style={styles.segmentItem} onPress={() => pick(() => setPayPeriod(value))}>
                  {active ? (
                    <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.segmentFill}>
                      <Text style={[styles.segmentText, { color: '#FFFFFF' }]}>{label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.segmentFill}>
                      <Text style={[styles.segmentText, { color: colors.text }]}>{label}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          {/* Toggles that combine: Trusted, Nearest, Lowest pay. */}
          <ScrollView
            horizontal
            style={styles.chipScroll}
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chips}
          >
            {chip('trusted', t('homeSearch.filters.trusted'), trustedOnly, () => pick(() => setTrustedOnly((on) => !on)), 'shield-halved')}
            {chip('nearest', t('hireStaff.sortNearest'), nearest, () => pick(() => setNearest((on) => !on)), 'location-arrow')}
            {chip('pay', t('hireStaff.sortPay'), lowestPay, () => pick(() => setLowestPay((on) => !on)), 'arrow-down-short-wide')}
          </ScrollView>
        </View>

        {renderBody()}
        <JobSeekerDetailModal person={selected} onClose={() => setSelected(null)} />
        <ToastHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  intro: { padding: 16, paddingTop: 4 },
  introHeading: { ...typography.body, fontFamily: fonts.semiBold, marginTop: 10, marginBottom: 12 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '31%',
    flexGrow: 1,
    minHeight: 96,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tileIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  tileText: { ...typography.caption, fontFamily: fonts.medium, textAlign: 'center' },
  howCard: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  howIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  howText: { ...typography.body, flex: 1 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingHorizontal: 4 },
  noteText: { ...typography.caption, flex: 1 },
  flex: { flex: 1 },
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
  filterCard: { marginHorizontal: 16, marginTop: 14, borderWidth: 1, borderRadius: 18, padding: 12, gap: 10 },
  chipScroll: { flexGrow: 0 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
  },
  searchInput: { flex: 1, ...typography.body, fontSize: 14, padding: 0 },
  chips: { gap: 8, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  chipDivider: { width: 1, height: 22, marginHorizontal: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, borderRadius: 17, paddingHorizontal: 13 },
  chipText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 12 },
  optionRow: { flexDirection: 'row', gap: 8 },
  segment: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 3 },
  segmentItem: { flex: 1 },
  segmentFill: { alignItems: 'center', justifyContent: 'center', height: 34, borderRadius: 11 },
  segmentText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5 },
  list: { paddingHorizontal: 16, paddingTop: 12, gap: 12, flexGrow: 1 },
  groupHeader: { marginTop: 4, marginBottom: 10 },
  carousel: { gap: 12, paddingRight: 4 },
  carouselCard: { width: 300 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#0B3A8A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  workRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  factsRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingVertical: 9, marginTop: 12 },
  fact: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  factDivider: { width: 1, height: 28 },
  factValue: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5, lineHeight: 18 },
  factLabel: { ...typography.caption, fontSize: 10.5, lineHeight: 14, marginTop: 1 },
  // Same size as the skill pill beside it.
  placeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flexShrink: 1,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    maxWidth: 130,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16 },
  jobTitle: { ...typography.caption, fontSize: 12.5, fontFamily: fonts.medium, flexShrink: 1 },
  distancePill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, borderRadius: 14, paddingHorizontal: 10 },
  distanceText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 16 },
  payRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 12 },
  pay: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 20 },
  per: { ...typography.body, fontSize: 13 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  // The skill and the place: each as wide as its words, both exactly this height.
  tag: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 28, borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, maxWidth: 130, flexShrink: 1 },
  rowSpacer: { flex: 1 },
  // The skill and place pills take the room left of Call (never more), each shrinking with
  // its text cut short — but the text keeps a minimum width, so it can't vanish (it did when it
  // could shrink to nothing).
  pillsRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexShrink: 1,
    minWidth: 0,
  },
  pillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 14, maxWidth: 110, minWidth: 34, flexShrink: 1 },
  tagText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, includeFontPadding: false, flexShrink: 1 },
  skills: { ...typography.body, fontSize: 13, marginTop: 10 },
  description: { ...typography.caption, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  locationText: { ...typography.caption, fontSize: 11, lineHeight: 14, fontFamily: fonts.medium, includeFontPadding: false, flexShrink: 1 },
  more: { ...typography.caption, fontFamily: fonts.semiBold },
  viewProfile: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    paddingTop: 10,
  },
  phoneGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  phoneIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  phone: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15, letterSpacing: 0.3 },
  callButton: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 17 },
  callText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13.5, color: '#FFFFFF', letterSpacing: 0.2 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 24 },
  stateTitle: { ...typography.body, fontFamily: fonts.semiBold, textAlign: 'center' },
  stateText: { ...typography.caption, textAlign: 'center', lineHeight: 18 },
  stateAction: { alignSelf: 'stretch', marginTop: 4 },
});
