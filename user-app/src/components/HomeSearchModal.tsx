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
import { GlassPanel } from './GlassPanel';
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
}

export type Scope = 'workers' | 'shops' | 'staff';
type Row =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'worker'; key: string; worker: WorkerNearbyResult }
  | { kind: 'shop'; key: string; shop: BusinessNearbyResult }
  | { kind: 'staff'; key: string; person: JobSeeker };

const DEBOUNCE_MS = 350;
const RESULT_LIMIT = 20;
const STAFF_SUGGESTIONS = JOB_CATEGORIES.filter((entry) => entry.key !== 'other');

/**
 * Home's search, all in one: a search box, then Services / Shops / Hire Staff tabs (Services
 * first). Before typing, the tab's items are listed A–Z (tap one to search it); while typing,
 * matching items (also ones partners made themselves) come first, then the people nearby.
 * Uses the nearby endpoints' free-text `query` and the shared device location; tapping a
 * result opens the shared detail view and records a profile view.
 */
export function HomeSearchModal({ visible, onClose, initialScope }: HomeSearchModalProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useThemeColors();
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

  useEffect(() => {
    if (!visible) return;
    setInput('');
    setQuery('');
    setScope(initialScope ?? 'workers');
    setSelected(null);
    setPerson(null);
  }, [visible, initialScope]);

  useEffect(() => {
    const suggestion = suggestionRef.current;
    const next = suggestion && suggestion.label === input ? suggestion.key : input.trim();
    const timer = setTimeout(() => setQuery(next), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const searching = visible && query.length > 0 && coords !== null;
  const workers = useQuery({
    queryKey: ['homeSearch', 'workers', query, coords?.latitude, coords?.longitude],
    queryFn: () =>
      workersService.searchNearby({
        latitude: coords!.latitude,
        longitude: coords!.longitude,
        radiusKm: SERVICES_RADIUS_KM,
        query,
        limit: RESULT_LIMIT,
      }),
    enabled: searching && scope === 'workers',
  });
  const shops = useQuery({
    queryKey: ['homeSearch', 'shops', query, coords?.latitude, coords?.longitude],
    queryFn: () =>
      businessesService.searchNearby({
        latitude: coords!.latitude,
        longitude: coords!.longitude,
        radiusKm: SERVICES_RADIUS_KM,
        query,
        limit: RESULT_LIMIT,
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
  const workerResults = showWorkers ? (workers.data ?? []) : [];
  const shopResults = showShops ? (shops.data ?? []) : [];
  const staffResults = showStaff ? (staff.data ?? []).slice(0, RESULT_LIMIT) : [];
  const loading =
    (showWorkers && workers.isLoading && workers.fetchStatus !== 'idle') ||
    (showShops && shops.isLoading && shops.fetchStatus !== 'idle') ||
    (showStaff && staff.isLoading && staff.fetchStatus !== 'idle');

  const rows: Row[] = [];
  if (workerResults.length > 0) {
    workerResults.forEach((worker) => rows.push({ kind: 'worker', key: `w-${worker.id}`, worker }));
  }
  if (shopResults.length > 0) {
    shopResults.forEach((shop) => rows.push({ kind: 'shop', key: `s-${shop.id}`, shop }));
  }
  if (staffResults.length > 0) {
    staffResults.forEach((entry) => rows.push({ kind: 'staff', key: `j-${entry.id}`, person: entry }));
  }

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
      return <Text style={[styles.groupHeader, { color: colors.textMuted }]}>{item.title}</Text>;
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
              <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
                {entry.fullName}
              </Text>
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
    const isWorker = item.kind === 'worker';
    const name = isWorker ? item.worker.accountFullName : item.shop.shopName;
    const photo = isWorker
      ? (item.worker.profilePhotoUrl)
      : (item.shop.profilePhotoUrl);
    const tags = isWorker
      ? item.worker.skillCategories.filter((k) => k !== 'other').map((k) => t(`workerProfile.skills.${k}`))
      : item.shop.shopCategories.filter((k) => k !== 'other').map((k) => t(`businessProfile.categories.${k}`));
    const distance = isWorker ? item.worker.distanceMeters : item.shop.distanceMeters;
    return (
      <Pressable
        style={[styles.resultRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => (isWorker ? openWorker(item.worker) : openShop(item.shop))}
      >
        <Avatar
          photoUrl={photo}
          name={name}
          size={48}
          seal={
            isWorker
              ? { kind: 'service', id: item.worker.id }
              : { kind: 'business', id: item.shop.id }
          }
        />
        <View style={styles.resultInfo}>
          <View style={styles.resultTitleRow}>
            <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
              {name}
            </Text>
            <View style={[styles.kindPill, { backgroundColor: `${colors.primary}14` }]}>
              <FontAwesome6 name={isWorker ? 'screwdriver-wrench' : 'store'} size={9} color={colors.primary} solid />
              <Text style={[styles.kindText, { color: colors.primary }]}>
                {t(isWorker ? 'homeSearch.worker' : 'homeSearch.shop')}
              </Text>
            </View>
          </View>
          <Text style={[styles.resultTags, { color: colors.textMuted }]} numberOfLines={1}>
            {tags.join(', ')}
          </Text>
          <View style={styles.resultMeta}>
            {isWorker ? <RatingStars average={item.worker.ratingAverage} count={item.worker.ratingCount} /> : null}
            <Text style={[styles.resultDistance, { color: colors.primary }]}>
              {t('nearbySearch.distanceAway', {
                distance: formatDistanceValue(distance),
              })}
            </Text>
          </View>
        </View>
        <FontAwesome6 name="chevron-right" size={12} color={colors.textMuted} solid />
      </Pressable>
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
      onPress={() => applySuggestion(item.label, item.key)}
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
    matchingItems.length > 0 || partnerItems.length > 0 ? (
      <View style={styles.matches}>
        <Text style={[styles.groupHeader, { color: colors.textMuted }]}>{t('homeSearch.matchingItems')}</Text>
        <View style={styles.itemGrid}>
          {matchingItems.slice(0, 6).map((item) => itemTile(item))}
          {partnerItems.map((name) => itemTile({ key: name, label: name, icon: scopeIcon }, true))}
        </View>
        {rows.length > 0 ? (
          <Text style={[styles.groupHeader, styles.resultsHeader, { color: colors.textMuted }]}>{t('homeSearch.nearbyResults')}</Text>
        ) : null}
      </View>
    ) : null;

  const renderBody = () => {
    if (location.status === 'denied' || location.status === 'disabled' || location.status === 'error') {
      return renderState('location-crosshairs', t('location.disabledTitle'), t('location.disabledMessage'), refreshLocation);
    }
    if (!coords) return renderState('location-crosshairs', t('services.locating'));
    if (!input) return renderItems();
    if (!loading && rows.length === 0 && !matchesHeader && query) {
      return renderState('magnifying-glass', t('homeSearch.noResultsTitle'), t('homeSearch.noResultsMessage', { query: input }));
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

  const searchFill = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.75)';

  const scopes: { key: Scope; label: string; icon: React.ComponentProps<typeof FontAwesome6>['name'] }[] = [
    { key: 'workers', label: t('homeSearch.tabServices'), icon: 'screwdriver-wrench' },
    { key: 'shops', label: t('homeSearch.tabShops'), icon: 'store' },
    { key: 'staff', label: t('homeSearch.tabStaff'), icon: 'user-tie' },
  ];
  const changeScope = (next: Scope) => {
    if (next === scope) return;
    setScope(next);
    applySuggestion('', '');
  };

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
                {t(locked ? `homeSearch.${initialScope}Subtitle` : 'homeSearch.subtitle')}
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
            <GlassPanel blurTarget={blurTargetRef} style={[styles.panel, locked ? styles.panelSingle : null]}>
              <View
                style={[
                  styles.searchBox,
                  // Scoped to one tab there are no chips, so the glass panel itself is the search bar.
                  locked ? styles.searchBoxSingle : { backgroundColor: searchFill, borderColor: `${colors.primary}26` },
                ]}
              >
                <FontAwesome6 name="magnifying-glass" size={14} color={colors.primary} solid />
                <TextInput
                  ref={inputRef}
                  style={[styles.searchInput, { color: colors.text }]}
                  value={input}
                  onChangeText={setInput}
                  placeholder={t(`homeSearch.${scope}Placeholder`)}
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
            </GlassPanel>
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
  matches: { marginBottom: 6 },
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
  panel: { borderRadius: 22, padding: 12 },
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
