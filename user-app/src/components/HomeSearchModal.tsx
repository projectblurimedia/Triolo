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
import { ToastHost } from './ToastHost';
import { GlassPanel } from './GlassPanel';
import { ANDROID_REAL_BLUR } from '@/state/blurTargetStore';
import { SKILL_CATEGORIES } from './WorkerProfileModal';
import { locationActionLabel, useDeviceLocation } from '@/hooks/useDeviceLocation';
import { SERVICES_RADIUS_KM } from '@/hooks/useNearbyWorkers';
import { WorkerNearbyResult, workersService } from '@/services/workersService';
import { BusinessNearbyResult, businessesService } from '@/services/businessesService';
import { formatDistanceValue, NearbySearchMode } from '@/utils/nearbyResult';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

interface HomeSearchModalProps {
  visible: boolean;
  onClose: () => void;
  /** Which results it opens on: Services opens on workers, Bazaar on shops. */
  initialScope?: Scope;
}

export type Scope = 'all' | 'workers' | 'shops';
type Row =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'worker'; key: string; worker: WorkerNearbyResult }
  | { kind: 'shop'; key: string; shop: BusinessNearbyResult };

const DEBOUNCE_MS = 350;
const RESULT_LIMIT = 20;
const SHOP_SUGGESTIONS = ['grocery', 'restaurant', 'pharmacy', 'electronics', 'clothing'];

/**
 * Home's search — one box over BOTH workers and marketplace shops near the device (the
 * Services tab and Nearby Workers/Shops searches are each one-sided). All / Workers / Shops
 * scopes; before typing, suggestion chips (skills and shop categories) fill the box. Uses the
 * same nearby endpoints' free-text `query` (skill/category, name, city, area) and the shared
 * device location; tapping a result opens the shared detail view and records a profile view.
 */
export function HomeSearchModal({ visible, onClose, initialScope = 'all' }: HomeSearchModalProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  // A tapped suggestion shows its (possibly Telugu) label in the box but searches by the
  // stable category key, which is what the backend matches against.
  const suggestionRef = useRef<{ label: string; key: string } | null>(null);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>(initialScope);
  const locked = initialScope !== 'all';
  const [selected, setSelected] = useState<{
    mode: NearbySearchMode;
    result: WorkerNearbyResult | BusinessNearbyResult;
  } | null>(null);
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
    setScope(initialScope);
    setSelected(null);
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
    enabled: searching && scope !== 'shops',
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
    enabled: searching && scope !== 'workers',
  });

  const workerResults = scope === 'shops' ? [] : (workers.data ?? []);
  const shopResults = scope === 'workers' ? [] : (shops.data ?? []);
  const loading =
    (scope !== 'shops' && workers.isLoading && workers.fetchStatus !== 'idle') ||
    (scope !== 'workers' && shops.isLoading && shops.fetchStatus !== 'idle');

  const rows: Row[] = [];
  if (workerResults.length > 0) {
    if (scope === 'all')
      rows.push({
        kind: 'header',
        key: 'h-workers',
        title: t('homeSearch.workersCount', { count: workerResults.length }),
      });
    workerResults.forEach((worker) => rows.push({ kind: 'worker', key: `w-${worker.id}`, worker }));
  }
  if (shopResults.length > 0) {
    if (scope === 'all')
      rows.push({
        kind: 'header',
        key: 'h-shops',
        title: t('homeSearch.shopsCount', { count: shopResults.length }),
      });
    shopResults.forEach((shop) => rows.push({ kind: 'shop', key: `s-${shop.id}`, shop }));
  }

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
    const isWorker = item.kind === 'worker';
    const name = isWorker ? item.worker.accountFullName : item.shop.shopName;
    const photo = isWorker ? item.worker.portfolioPhotoUrls[0] : item.shop.shopPhotoUrls[0];
    const tags = isWorker
      ? item.worker.skillCategories.filter((k) => k !== 'other').map((k) => t(`workerProfile.skills.${k}`))
      : item.shop.shopCategories.filter((k) => k !== 'other').map((k) => t(`businessProfile.categories.${k}`));
    const distance = isWorker ? item.worker.distanceMeters : item.shop.distanceMeters;
    return (
      <Pressable
        style={[styles.resultRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => (isWorker ? openWorker(item.worker) : openShop(item.shop))}
      >
        <Avatar photoUrl={photo} name={name} size={48} />
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

  const renderSuggestions = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.suggestions, { paddingTop: contentTop }]}
    >
      {initialScope === 'shops' ? null : (
        <>
          <Text style={[styles.groupHeader, { color: colors.textMuted }]}>{t('homeSearch.tryServices')}</Text>
          <View style={styles.chipRow}>
            {SKILL_CATEGORIES.map((skill) => (
              <Pressable
                key={skill.key}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => applySuggestion(t(`workerProfile.skills.${skill.key}`), skill.key)}
              >
                <FontAwesome6 name={skill.icon} size={11} color={colors.primary} solid />
                <Text style={[styles.chipText, { color: colors.text }]}>{t(`workerProfile.skills.${skill.key}`)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {initialScope === 'workers' ? null : (
        <>
          <Text style={[styles.groupHeader, { color: colors.textMuted }]}>{t('homeSearch.tryShops')}</Text>
          <View style={styles.chipRow}>
            {SHOP_SUGGESTIONS.map((key) => (
              <Pressable
                key={key}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => applySuggestion(t(`businessProfile.categories.${key}`), key)}
              >
                <FontAwesome6 name="store" size={11} color={colors.primary} solid />
                <Text style={[styles.chipText, { color: colors.text }]}>{t(`businessProfile.categories.${key}`)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderBody = () => {
    if (location.status === 'denied' || location.status === 'disabled' || location.status === 'error') {
      return renderState('location-crosshairs', t('location.disabledTitle'), t('location.disabledMessage'), refreshLocation);
    }
    if (!coords) return renderState('location-crosshairs', t('services.locating'));
    if (!query) return renderSuggestions();
    if (loading) {
      return (
        <View style={[styles.stateBody, { paddingTop: contentTop }]}>
          <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
        </View>
      );
    }
    if (rows.length === 0) {
      return renderState('magnifying-glass', t('homeSearch.noResultsTitle'), t('homeSearch.noResultsMessage', { query }));
    }
    return (
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        contentContainerStyle={[styles.listContent, { paddingTop: contentTop }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const searchFill = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.75)';

  const scopes: { key: Scope; label: string }[] = [
    { key: 'all', label: t('homeSearch.scopeAll') },
    { key: 'workers', label: t('homeSearch.scopeWorkers') },
    { key: 'shops', label: t('homeSearch.scopeShops') },
  ];

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
                  placeholder={t(locked ? `homeSearch.${initialScope}Placeholder` : 'homeSearch.placeholder')}
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
                <View style={styles.scopeRow}>
                  {scopes.map((option) => {
                    const active = scope === option.key;
                    return (
                      <Pressable key={option.key} onPress={() => setScope(option.key)} style={styles.scopeChipWrap}>
                        {active ? (
                          <LinearGradient
                            colors={headerGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.scopeChip}
                          >
                            <Text style={[styles.scopeText, { color: '#FFFFFF' }]}>{option.label}</Text>
                          </LinearGradient>
                        ) : (
                          <View
                            style={[
                              styles.scopeChip,
                              {
                                borderColor: `${colors.primary}33`,
                                borderWidth: 1,
                              },
                            ]}
                          >
                            <Text style={[styles.scopeText, { color: colors.text }]}>{option.label}</Text>
                          </View>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  scopeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  scopeChipWrap: { borderRadius: 16, overflow: 'hidden' },
  scopeChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 16 },
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
