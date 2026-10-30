import React, { useEffect, useRef, useState } from 'react';
import { FlatList, LayoutChangeEvent, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LoadingIndicator } from './LoadingIndicator';
import { RatingStars } from './RatingStars';
import { Avatar } from './WorkerMiniCard';
import { NearbyResultDetailModal } from './NearbyResultDetailModal';
import { JobSeekerDetailModal, jobSeekerTitle } from './JobSeekerDetailModal';
import { ToastHost } from './ToastHost';
import { CategoryPicker } from './CategoryPicker';
import { useTrustedIds } from '@/hooks/useSubscription';
import { SectionHeader } from './SectionHeader';
import { SearchResultCard } from './SearchResultCard';
import { HighlightText, matchesTerm } from './HighlightText';
import { ANDROID_REAL_BLUR } from '@/state/blurTargetStore';
import { SHOP_CATEGORIES, SKILL_CATEGORIES } from '@/constants/categories';
import { locationActionLabel, useDeviceLocation } from '@/hooks/useDeviceLocation';
import { SERVICES_RADIUS_KM } from '@/hooks/useNearbyWorkers';
import { WorkerNearbyResult, workersService } from '@/services/workersService';
import { BusinessNearbyResult, businessesService } from '@/services/businessesService';
import { JOB_CATEGORIES, JobSeeker, jobSeekersService } from '@/services/jobSeekersService';
import { formatRupees } from '@/services/ordersService';
import { formatDistanceValue, NearbySearchMode } from '@/utils/nearbyResult';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

interface HomeSearchModalProps {
  visible: boolean;
  onClose: () => void;
  /** Services opens it on workers, Bazaar on shops (and it stays there); Home lets you switch. */
  initialScope?: Scope;
  /** Choosing a shop for something (a list to send): a tapped shop is picked, not opened. */
  onPickShop?: (shop: BusinessNearbyResult) => void;
}

export type Scope = 'workers' | 'shops' | 'staff';
type Row =
  | { kind: 'header'; key: string; title: string; icon: React.ComponentProps<typeof FontAwesome6>['name']; count: number }
  | { kind: 'worker'; key: string; worker: WorkerNearbyResult }
  | { kind: 'shop'; key: string; shop: BusinessNearbyResult }
  | { kind: 'staff'; key: string; person: JobSeeker };

const DEBOUNCE_MS = 350;
const RESULT_LIMIT = 20;
// Only Trusted ones are kept on the phone, so fetch more to have enough left.
const TRUSTED_FETCH_LIMIT = 50;
const STAFF_SUGGESTIONS = JOB_CATEGORIES.filter((entry) => entry.key !== 'other');

/**
 * Home's search, all in one: a search box, then Services / Shops / Hire Staff tabs (Services
 * first). For workers and shops, filters sit under the box — Nearest / Top rated, Trusted,
 * Delivery (shops) and the type — and any filter lists results even before typing. Before typing, the tab's items are listed A–Z (tap one to search it); while typing,
 * matching items (also ones partners made themselves) come first, then the people nearby.
 * Uses the nearby endpoints' free-text `query` and the shared device location; tapping a
 * result opens the shared detail view and records a profile view.
 */
export function HomeSearchModal({ visible, onClose, initialScope, onPickShop }: HomeSearchModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  // A tapped suggestion shows its (possibly Telugu) label in the box but searches by the
  // stable category key, which is what the backend matches against.
  const suggestionRef = useRef<{ label: string; key: string } | null>(null);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>(initialScope ?? 'workers');
  const locked = initialScope !== undefined;
  const [selected, setSelected] = useState<{
    mode: NearbySearchMode;
    result: WorkerNearbyResult | BusinessNearbyResult;
  } | null>(null);
  const [person, setPerson] = useState<JobSeeker | null>(null);
  const { location, refresh: refreshLocation } = useDeviceLocation();
  // The glass search panel floats over the results; content starts below it and scrolls
  // under it (blurred), like the bottom tab bar.
  const blurTargetRef = useRef<View>(null);
  const [panelHeight, setPanelHeight] = useState(118);
  const contentTop = panelHeight + 24;
  const onPanelLayout = (event: LayoutChangeEvent) => setPanelHeight(Math.round(event.nativeEvent.layout.height));
  const coords = location.status === 'ready' ? location : null;
  // Nearest and Top rated work together: Top rated keeps 4★ and up, Nearest puts the closest first.
  const [nearest, setNearest] = useState(false);
  const [topRated, setTopRated] = useState(false);
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [types, setTypes] = useState<string[]>([]);
  const trusted = useTrustedIds();

  const resetFilters = () => {
    setNearest(false);
    setTopRated(false);
    setTrustedOnly(false);
    setDeliveryOnly(false);
    setTypes([]);
  };

  useEffect(() => {
    if (!visible) return;
    setInput('');
    setQuery('');
    setScope(initialScope ?? 'workers');
    setSelected(null);
    setPerson(null);
    resetFilters();
  }, [visible, initialScope]);

  useEffect(() => {
    const suggestion = suggestionRef.current;
    const next = suggestion && suggestion.label === input ? suggestion.key : input.trim();
    const timer = setTimeout(() => setQuery(next), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const hasFilters = scope !== 'staff';
  const typeKey = types.length > 0 ? types.join(',') : undefined;
  // A kind is picked: the box searches names within it, not kinds.
  const byName = hasFilters && types.length > 0;
  const filtering =
    hasFilters && (nearest || topRated || trustedOnly || (scope === 'shops' && deliveryOnly) || types.length > 0);
  const searching = visible && (query.length > 0 || filtering) && coords !== null;
  const sort: 'distance' | 'rating' = topRated && !nearest ? 'rating' : 'distance';
  const fetchLimit = trustedOnly || topRated ? TRUSTED_FETCH_LIMIT : RESULT_LIMIT;
  const workers = useQuery({
    queryKey: ['homeSearch', 'workers', query, coords?.latitude, coords?.longitude, sort, typeKey, byName, fetchLimit],
    queryFn: () =>
      workersService.searchNearby({
        latitude: coords!.latitude,
        longitude: coords!.longitude,
        radiusKm: SERVICES_RADIUS_KM,
        query: query || undefined,
        skillCategory: typeKey,
        nameOnly: byName,
        sort,
        limit: fetchLimit,
      }),
    enabled: searching && scope === 'workers',
  });
  const shops = useQuery({
    queryKey: ['homeSearch', 'shops', query, coords?.latitude, coords?.longitude, sort, typeKey, byName, deliveryOnly, fetchLimit],
    queryFn: () =>
      businessesService.searchNearby({
        latitude: coords!.latitude,
        longitude: coords!.longitude,
        radiusKm: SERVICES_RADIUS_KM,
        query: query || undefined,
        shopCategory: typeKey,
        nameOnly: byName,
        deliveryOnly,
        sort,
        limit: fetchLimit,
      }),
    enabled: searching && scope === 'shops',
  });
  const staff = useQuery({
    queryKey: ['homeSearch', 'staff', query, coords?.latitude, coords?.longitude],
    queryFn: () =>
      jobSeekersService.search({
        latitude: coords!.latitude,
        longitude: coords!.longitude,
        radiusKm: SERVICES_RADIUS_KM,
        query,
        sort: 'distance',
      }),
    enabled: searching && scope === 'staff',
  });

  const showWorkers = scope === 'workers';
  const showShops = scope === 'shops';
  const showStaff = scope === 'staff';
  const isTrusted = (kind: 'service' | 'business', id: string) => !!trusted.data?.[kind]?.includes(id);
  const TOP_RATED_MIN = 4;
  const keep = (kind: 'service' | 'business', id: string, rating: number | null) =>
    (!trustedOnly || isTrusted(kind, id)) && (!topRated || (rating ?? 0) >= TOP_RATED_MIN);
  const workerResults = showWorkers
    ? (workers.data ?? []).filter((worker) => keep('service', worker.id, worker.ratingAverage)).slice(0, RESULT_LIMIT)
    : [];
  const shopResults = showShops
    ? (shops.data ?? []).filter((shop) => keep('business', shop.id, shop.ratingAverage)).slice(0, RESULT_LIMIT)
    : [];
  const staffResults = showStaff ? (staff.data ?? []).slice(0, RESULT_LIMIT) : [];
  const loading =
    (showWorkers && workers.isLoading && workers.fetchStatus !== 'idle') ||
    (showShops && shops.isLoading && shops.fetchStatus !== 'idle') ||
    (showStaff && staff.isLoading && staff.fetchStatus !== 'idle');

  // What was typed, marked in the cards. While typing, results are split into the people / shops
  // whose name matches and those found by their kind of work / shop (or place).
  const term = input.trim();
  const rows: Row[] = [];
  const pushGroups = <T,>(
    list: T[],
    nameOf: (entry: T) => string,
    toRow: (entry: T) => Row,
    groups: { named: string; other: string; namedIcon: React.ComponentProps<typeof FontAwesome6>['name']; otherIcon: React.ComponentProps<typeof FontAwesome6>['name']; prefix: string },
  ) => {
    if (list.length === 0) return;
    if (!term) {
      list.forEach((entry) => rows.push(toRow(entry)));
      return;
    }
    const named = list.filter((entry) => matchesTerm(nameOf(entry), term));
    const other = list.filter((entry) => !matchesTerm(nameOf(entry), term));
    if (named.length > 0) {
      rows.push({ kind: 'header', key: `${groups.prefix}-h-named`, title: groups.named, icon: groups.namedIcon, count: named.length });
      named.forEach((entry) => rows.push(toRow(entry)));
    }
    if (other.length > 0) {
      rows.push({ kind: 'header', key: `${groups.prefix}-h-other`, title: groups.other, icon: groups.otherIcon, count: other.length });
      other.forEach((entry) => rows.push(toRow(entry)));
    }
  };
  pushGroups(workerResults, (worker) => worker.accountFullName, (worker) => ({ kind: 'worker', key: `w-${worker.id}`, worker }), {
    named: t('homeSearch.groups.workers'),
    other: t('homeSearch.groups.workersByWork'),
    namedIcon: 'user',
    otherIcon: 'screwdriver-wrench',
    prefix: 'w',
  });
  pushGroups(shopResults, (shop) => shop.shopName, (shop) => ({ kind: 'shop', key: `s-${shop.id}`, shop }), {
    named: t('homeSearch.groups.shops'),
    other: t('homeSearch.groups.shopsByType'),
    namedIcon: 'store',
    otherIcon: 'tags',
    prefix: 's',
  });
  pushGroups(staffResults, (entry) => entry.fullName, (entry) => ({ kind: 'staff', key: `j-${entry.id}`, person: entry }), {
    named: t('homeSearch.groups.people'),
    other: t('homeSearch.groups.peopleByWork'),
    namedIcon: 'user',
    otherIcon: 'user-tie',
    prefix: 'j',
  });

  const scopeItems = (
    scope === 'workers'
      ? SKILL_CATEGORIES.map((entry) => ({ key: entry.key, label: t(`workerProfile.skills.${entry.key}`), icon: entry.icon as string }))
      : scope === 'shops'
        ? SHOP_CATEGORIES.map((entry) => ({ key: entry.key, label: t(`businessProfile.categories.${entry.key}`), icon: entry.icon as string }))
        : STAFF_SUGGESTIONS.map((entry) => ({ key: entry.key, label: t(`hireStaff.categories.${entry.key}`), icon: entry.icon as string }))
  ).sort((a, b) => a.label.localeCompare(b.label));
  const typed = input.trim();
  // A tapped item shows its label in the box; that's a chosen item, not something typed.
  const chosen = !!suggestionRef.current && suggestionRef.current.label === input;
  const matchingItems = typed && !chosen ? scopeItems.filter((item) => item.label.toLowerCase().includes(typed.toLowerCase())) : [];
  const partnerMade = useQuery({
    queryKey: ['homeSearch', 'custom', scope, typed],
    queryFn: () =>
      scope === 'workers'
        ? workersService.customSkills(typed)
        : scope === 'shops'
          ? businessesService.customCategories(typed)
          : jobSeekersService.customTitles(typed),
    enabled: visible && typed.length >= 2 && !chosen,
    staleTime: 60_000,
  });
  const partnerItems = (partnerMade.data ?? [])
    .filter((name) => !scopeItems.some((item) => item.label.toLowerCase() === name.toLowerCase()))
    .slice(0, 6);
  const scopeIcon = scope === 'workers' ? 'screwdriver-wrench' : scope === 'shops' ? 'store' : 'user-tie';

  const openWorker = (worker: WorkerNearbyResult) => {
    setSelected({ mode: 'worker', result: worker });
    workersService.recordView(worker.id).catch(() => {});
  };
  const openShop = (shop: BusinessNearbyResult) => {
    if (onPickShop) {
      onPickShop(shop);
      onClose();
      return;
    }
    setSelected({ mode: 'business', result: shop });
    businessesService.recordView(shop.id).catch(() => {});
  };

  const applySuggestion = (label: string, key: string) => {
    suggestionRef.current = label ? { label, key } : null;
    setInput(label);
    setQuery(key);
  };

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'header') {
      return <SectionHeader title={item.title} icon={item.icon} count={item.count} style={styles.resultGroupHeader} />;
    }
    if (item.kind === 'staff') {
      const entry = item.person;
      return (
        <Pressable
          style={[styles.resultRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setPerson(entry)}
        >
          <Avatar photoUrl={entry.photoUrl ?? undefined} name={entry.fullName} size={48} seal={{ kind: 'job_post', id: entry.id }} />
          <View style={styles.resultInfo}>
            <View style={styles.resultTitleRow}>
              <HighlightText text={entry.fullName} term={term} style={[styles.resultName, { color: colors.text }]} numberOfLines={1} />
              <View style={[styles.kindPill, { backgroundColor: `${colors.primary}14` }]}>
                <FontAwesome6 name="user-tie" size={9} color={colors.primary} solid />
                <Text style={[styles.kindText, { color: colors.primary }]}>{t('homeSearch.staff')}</Text>
              </View>
            </View>
            <Text style={[styles.resultTags, { color: colors.textMuted }]} numberOfLines={1}>
              {jobSeekerTitle(entry, t)} · {formatRupees(entry.payAmount)} / {t(`hireStaff.per.${entry.payPeriod}`)}
            </Text>
            <View style={styles.resultMeta}>
              <Text style={[styles.resultDistance, { color: colors.primary }]}>
                {t('nearbySearch.distanceAway', { distance: formatDistanceValue(entry.distanceMeters) })}
              </Text>
            </View>
          </View>
          <FontAwesome6 name="chevron-right" size={12} color={colors.textMuted} solid />
        </Pressable>
      );
    }
    return item.kind === 'worker' ? (
      <SearchResultCard kind="worker" worker={item.worker} term={term} onPress={() => openWorker(item.worker)} />
    ) : (
      <SearchResultCard kind="shop" shop={item.shop} term={term} onPress={() => openShop(item.shop)} />
    );
  };

  const renderState = (
    icon: React.ComponentProps<typeof FontAwesome6>['name'],
    title: string,
    message?: string,
    action?: () => void,
  ) => (
    <View style={[styles.stateBody, { paddingTop: contentTop }]}>
      <View style={[styles.stateIcon, { backgroundColor: `${colors.primary}14` }]}>
        <FontAwesome6 name={icon} size={22} color={colors.primary} solid />
      </View>
      <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      {message ? <Text style={[styles.stateMessage, { color: colors.textMuted }]}>{message}</Text> : null}
      {action ? (
        <Pressable style={[styles.stateButton, { backgroundColor: colors.primary }]} onPress={action}>
          <Text style={styles.stateButtonText}>{locationActionLabel(location, t)}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  /** One item tile (A–Z grid before typing, and the matches while typing). */
  const itemTile = (item: { key: string; label: string; icon: string }, partner = false) => (
    <Pressable
      key={`${partner ? 'p' : 'i'}-${item.key}`}
      onPress={() => pickItem(item, partner)}
      style={({ pressed }) => [
        styles.itemTile,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.itemIcon}>
        <FontAwesome6 name={item.icon as never} size={14} color="#FFFFFF" solid />
      </LinearGradient>
      <View style={styles.flex}>
        <Text style={[styles.itemLabel, { color: colors.text }]} numberOfLines={2}>
          {item.label}
        </Text>
        {partner ? <Text style={[styles.itemHint, { color: colors.textMuted }]}>{t('picker.partnerMade')}</Text> : null}
      </View>
    </Pressable>
  );

  /**
   * A tapped kind of work / shop (Plumber, Grocery…) becomes a type filter: it's added to the
   * dropdown and the box is cleared, now for names within it. Partner-made names (not one of
   * the fixed kinds) and Hire Staff still search by the words.
   */
  const pickItem = (item: { key: string; label: string }, partner: boolean) => {
    if (hasFilters && !partner) {
      setTypes((current) => (current.includes(item.key) ? current : [...current, item.key]));
      applySuggestion('', '');
      return;
    }
    applySuggestion(item.label, item.key);
  };

  const renderItems = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.suggestions, { paddingTop: contentTop }]}
    >
      <Text style={[styles.groupHeader, { color: colors.textMuted }]}>
        {t(`homeSearch.browse.${scope}`, { count: scopeItems.length })}
      </Text>
      <View style={styles.itemGrid}>{scopeItems.map((item) => itemTile(item))}</View>
    </ScrollView>
  );

  /** While typing: the matching items (fixed and partner-made) above the people found. */
  const matchesHeader =
    !byName && (matchingItems.length > 0 || partnerItems.length > 0) ? (
      <View style={styles.matches}>
        <SectionHeader
          title={t(scope === 'workers' ? 'homeSearch.groups.workTypes' : scope === 'shops' ? 'homeSearch.groups.shopTypes' : 'homeSearch.groups.staffTypes')}
          icon={scope === 'shops' ? 'tags' : 'layer-group'}
          count={Math.min(matchingItems.length, 6) + partnerItems.length}
          style={styles.resultGroupHeaderFirst}
        />
        <View style={styles.itemGrid}>
          {matchingItems.slice(0, 6).map((item) => itemTile(item))}
          {partnerItems.map((name) => itemTile({ key: name, label: name, icon: scopeIcon }, true))}
        </View>
      </View>
    ) : null;

  const renderBody = () => {
    if (location.status === 'denied' || location.status === 'disabled' || location.status === 'error') {
      return renderState('location-crosshairs', t('location.disabledTitle'), t('location.disabledMessage'), refreshLocation);
    }
    if (!coords) return renderState('location-crosshairs', t('services.locating'));
    if (!input && !filtering) return renderItems();
    if (!loading && rows.length === 0 && !matchesHeader && (query || filtering)) {
      return renderState(
        'magnifying-glass',
        t('homeSearch.noResultsTitle'),
        input ? t('homeSearch.noResultsMessage', { query: input }) : t('homeSearch.filters.noResults'),
      );
    }
    return (
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        ListHeaderComponent={matchesHeader}
        ListFooterComponent={
          loading || query !== (chosen ? suggestionRef.current?.key : typed) ? (
            <View style={styles.loadingRow}>
              <LoadingIndicator size={30} dotSize={4} color={colors.primary} />
            </View>
          ) : null
        }
        contentContainerStyle={[styles.listContent, { paddingTop: contentTop }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    );
  };

  // Controls inside the search card look like Home's search bar (light, with a hairline border).
  const searchFill = colors.surface;

  const scopes: { key: Scope; label: string; icon: React.ComponentProps<typeof FontAwesome6>['name'] }[] = [
    { key: 'workers', label: t('homeSearch.tabServices'), icon: 'screwdriver-wrench' },
    { key: 'shops', label: t('homeSearch.tabShops'), icon: 'store' },
    { key: 'staff', label: t('homeSearch.tabStaff'), icon: 'user-tie' },
  ];
  const changeScope = (next: Scope) => {
    if (next === scope) return;
    setScope(next);
    applySuggestion('', '');
    resetFilters();
  };

  /** One filter chip: blue and filled when on. */
  const filterChip = (
    key: string,
    label: string,
    icon: React.ComponentProps<typeof FontAwesome6>['name'],
    active: boolean,
    onPress: () => void,
  ) => (
    <Pressable key={key} onPress={onPress} accessibilityState={{ selected: active }}>
      {active ? (
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.filterChip}>
          <FontAwesome6 name={icon} size={11} color="#FFFFFF" solid />
          <Text style={[styles.filterText, { color: '#FFFFFF' }]}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.filterChip, styles.filterChipOff, { backgroundColor: searchFill, borderColor: `${colors.primary}26` }]}>
          <FontAwesome6 name={icon} size={11} color={colors.primary} solid />
          <Text style={[styles.filterText, { color: colors.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );

  const typeOptions =
    scope === 'workers'
      ? SKILL_CATEGORIES.map((entry) => ({ key: entry.key, label: t(`workerProfile.skills.${entry.key}`), icon: entry.icon }))
      : SHOP_CATEGORIES.map((entry) => ({ key: entry.key, label: t(`businessProfile.categories.${entry.key}`), icon: entry.icon }));

  const renderFilters = () =>
    hasFilters ? (
      <View style={styles.filters}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.filterRow}
        >
          {filterChip('nearest', t('services.sortNearest'), 'location-arrow', nearest, () => setNearest((on) => !on))}
          {filterChip('rated', t('homeSearch.filters.topRated'), 'star', topRated, () => setTopRated((on) => !on))}
          {filterChip('trusted', t('homeSearch.filters.trusted'), 'shield-halved', trustedOnly, () => setTrustedOnly((on) => !on))}
          {scope === 'shops'
            ? filterChip('delivery', t('sendList.deliveryFilter'), 'truck', deliveryOnly, () => setDeliveryOnly((on) => !on))
            : null}
        </ScrollView>
        <CategoryPicker
          title={t(scope === 'workers' ? 'homeSearch.filters.workType' : 'homeSearch.filters.shopType')}
          placeholder={t(scope === 'workers' ? 'homeSearch.filters.anyWork' : 'homeSearch.filters.anyShop')}
          options={typeOptions}
          selected={types}
          onChange={setTypes}
          clearable
          fieldIcon="filter"
          // Kinds partners typed themselves (e.g. Fancy) are listed too.
          searchCustom={scope === 'workers' ? workersService.customSkills : businessesService.customCategories}
        />
      </View>
    ) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      onShow={() => setTimeout(() => inputRef.current?.focus(), 150)}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.cancel')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.headerTitle}>{t(locked ? `homeSearch.${initialScope}Title` : 'homeSearch.title')}</Text>
              <Text style={styles.headerSubtitle}>
                {onPickShop
                  ? t('homeSearch.pickShopSubtitle')
                  : t(locked ? `homeSearch.${initialScope}Subtitle` : 'homeSearch.subtitle')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.flex}>
          {/* Results live in a blur target so the glass panel really blurs them (Android 12+). */}
          {ANDROID_REAL_BLUR ? (
            <BlurTargetView ref={blurTargetRef} style={styles.flex}>
              {renderBody()}
            </BlurTargetView>
          ) : (
            <View ref={blurTargetRef} style={styles.flex}>
              {renderBody()}
            </View>
          )}

          <View style={styles.panelWrap} onLayout={onPanelLayout}>
            {/* The page's own colour, so the card blends into the screen; light inputs on it. */}
            <View
              style={[
                styles.panel,
                locked && !hasFilters
                  ? [styles.panelSingle, { backgroundColor: searchFill, borderColor: `${colors.primary}26` }]
                  : { backgroundColor: colors.background, borderColor: `${colors.primary}1F` },
              ]}
            >
              <View
                style={[
                  styles.searchBox,
                  // Scoped to Hire Staff nothing sits under it, so the glass panel itself is the search bar.
                  locked && !hasFilters
                    ? styles.searchBoxSingle
                    : { backgroundColor: searchFill, borderColor: `${colors.primary}26` },
                ]}
              >
                <FontAwesome6 name="magnifying-glass" size={14} color={colors.primary} solid />
                <TextInput
                  ref={inputRef}
                  style={[styles.searchInput, { color: colors.text }]}
                  value={input}
                  onChangeText={setInput}
                  placeholder={byName ? t(`homeSearch.filters.${scope}NamePlaceholder`) : t(`homeSearch.${scope}Placeholder`)}
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="search"
                  onSubmitEditing={() =>
                    setQuery(suggestionRef.current?.label === input ? suggestionRef.current.key : input.trim())
                  }
                />
                {input ? (
                  <Pressable onPress={() => applySuggestion('', '')} hitSlop={8} accessibilityLabel={t('common.close')}>
                    <FontAwesome6 name="circle-xmark" size={15} color={colors.textMuted} solid />
                  </Pressable>
                ) : null}
              </View>
              {locked ? null : (
                <View style={[styles.scopeRow, { backgroundColor: `${colors.primary}12` }]}>
                  {scopes.map((option) => {
                    const active = scope === option.key;
                    const content = (
                      <>
                        <FontAwesome6 name={option.icon} size={12} color={active ? '#FFFFFF' : colors.primary} solid />
                        <Text style={[styles.scopeText, { color: active ? '#FFFFFF' : colors.text }]} numberOfLines={1}>
                          {option.label}
                        </Text>
                      </>
                    );
                    return (
                      <Pressable key={option.key} onPress={() => changeScope(option.key)} style={styles.scopeChipWrap}>
                        {active ? (
                          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.scopeChip}>
                            {content}
                          </LinearGradient>
                        ) : (
                          <View style={styles.scopeChip}>{content}</View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {renderFilters()}
            </View>
          </View>
        </View>
        <ToastHost />
      </View>

      <NearbyResultDetailModal
        visible={selected !== null}
        onClose={() => setSelected(null)}
        mode={selected?.mode ?? 'worker'}
        result={selected?.result ?? null}
      />
      <JobSeekerDetailModal person={person} onClose={() => setPerson(null)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  itemTile: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 58,
  },
  itemIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 17 },
  itemHint: { ...typography.caption, fontSize: 10, marginTop: 1 },
  matches: { marginBottom: 2 },
  resultGroupHeader: { marginTop: 14, marginBottom: 10 },
  resultGroupHeaderFirst: { marginTop: 0, marginBottom: 10 },
  filters: { marginTop: 10, gap: 10 },
  filterRow: { gap: 8, paddingRight: 4 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, borderRadius: 17, paddingHorizontal: 13 },
  filterChipOff: { borderWidth: 1 },
  filterText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, includeFontPadding: false },
  resultsHeader: { marginTop: 18 },
  loadingRow: { alignItems: 'center', paddingVertical: 20 },
  container: { flex: 1 },
  header: { paddingBottom: 14, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flex: { flex: 1 },
  headerTitle: {
    ...typography.subheading,
    fontFamily: fonts.semiBold,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  headerSubtitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  panelWrap: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    borderRadius: 22,
    shadowColor: '#0B3A8A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  panel: { borderRadius: 22, padding: 12, borderWidth: 1, overflow: 'hidden' },
  panelSolid: { borderWidth: 1 },
  panelSingle: { padding: 0, borderRadius: 18 },
  searchBoxSingle: { height: 54, borderWidth: 0, paddingHorizontal: 18, borderRadius: 18 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: fonts.regular, padding: 0 },
  scopeRow: { flexDirection: 'row', gap: 4, marginTop: 10, borderRadius: 14, padding: 4 },
  scopeChipWrap: { flex: 1, borderRadius: 11, overflow: 'hidden' },
  scopeChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 11, paddingHorizontal: 6 },
  scopeText: { ...typography.caption, fontFamily: fonts.semiBold },
  listContent: { padding: 20, paddingBottom: 40 },
  groupHeader: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    marginBottom: 10,
    marginTop: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  resultInfo: { flex: 1, gap: 2 },
  resultTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultName: { ...typography.body, fontFamily: fonts.semiBold, flexShrink: 1 },
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  kindText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10 },
  resultTags: { ...typography.caption, fontSize: 12 },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  resultDistance: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  suggestions: { padding: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { ...typography.caption, fontFamily: fonts.medium },
  stateBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  stateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  stateTitle: {
    ...typography.subheading,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
  },
  stateMessage: {
    ...typography.body,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  stateButton: {
    marginTop: 18,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 12,
  },
  stateButtonText: {
    ...typography.body,
    fontFamily: fonts.semiBold,
    color: '#FFFFFF',
  },
});
