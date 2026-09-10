import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingIndicator } from './LoadingIndicator';
import { SHOP_GRADIENT } from './BusinessProfileModal';
import { NearbyResultDetailModal } from './NearbyResultDetailModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { workersService, WorkerNearbyResult } from '@/services/workersService';
import { businessesService, BusinessNearbyResult } from '@/services/businessesService';
import { formatAddress } from '@/utils/formatAddress';
import { formatDistanceValue, isWorkerResult, NearbyResult, NearbySearchMode } from '@/utils/nearbyResult';

export type { NearbySearchMode, NearbyResult };

type RangeUnit = 'km' | 'm';

interface NearbySearchModalProps {
  visible: boolean;
  onClose: () => void;
  mode: NearbySearchMode;
}

type LocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'error' }
  | { status: 'ready'; latitude: number; longitude: number };

type ResultsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: NearbyResult[] };

const DEFAULT_RANGE_VALUE = '5';
const DEFAULT_RANGE_UNIT: RangeUnit = 'km';
// Listed M first, then KM, per explicit ordering request — this is display order only,
// the default selected unit is still 'km' (DEFAULT_RANGE_UNIT above).
const RANGE_UNITS: RangeUnit[] = ['m', 'km'];
// Matches the backend's own nearbySearchQuerySchema (min 0.1, max 50) — clamped client-side
// too so a typed value never produces a request the API would just reject as VALIDATION_ERROR.
const MIN_RADIUS_KM = 0.1;
const MAX_RADIUS_KM = 50;
const SEARCH_DEBOUNCE_MS = 350;

function toRadiusKm(value: string, unit: RangeUnit): number | null {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const km = unit === 'km' ? parsed : parsed / 1000;
  return Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, km));
}

/**
 * Opened from Home's menu ("Nearby Workers" / "Nearby Shops") — full-screen search UI,
 * same chrome pattern as WorkerProfileModal/BusinessProfileModal (gradient header, left
 * back button). Always the constant brand-blue `headerGradient` for the header itself
 * (both modes), per the earlier explicit instruction not to reintroduce `SHOP_GRADIENT`
 * there — only individual shop result rows use the orange accent, matching
 * BusinessProfileCard's own capability-identity convention.
 *
 * Real GPS-based, distance-accurate search (Pending Module 4's discovery piece) — device
 * location via expo-location (same permission/getCurrentPositionAsync pattern already
 * proven in AddressPicker), then GET /workers/nearby or /businesses/nearby (Haversine
 * distance computed in SQL server-side, see backend repositories) filtered to verified
 * profiles within a user-typed range (a numeric input plus an M/KM unit picker, defaulting
 * to 5km — replaced an earlier fixed-chip-row version per explicit request for free-form
 * input instead of presets; Miles was dropped from the unit picker per a later explicit
 * request too), re-queried (debounced) whenever the free-text search box or the range
 * changes. The search box, range input, and unit picker trigger all sit in one row, per
 * explicit request. Tapping a result card opens `NearbyResultDetailModal` for a fuller,
 * read-only view of that profile.
 */
export function NearbySearchModal({ visible, onClose, mode }: NearbySearchModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [rangeValue, setRangeValue] = useState(DEFAULT_RANGE_VALUE);
  const [rangeUnit, setRangeUnit] = useState<RangeUnit>(DEFAULT_RANGE_UNIT);
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);
  const [location, setLocation] = useState<LocationState>({ status: 'idle' });
  const [results, setResults] = useState<ResultsState>({ status: 'idle' });
  const [selectedResult, setSelectedResult] = useState<NearbyResult | null>(null);
  const isWorker = mode === 'worker';
  const accentColor = isWorker ? colors.primary : SHOP_GRADIENT[0];
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const radiusKm = useMemo(() => toRadiusKm(rangeValue, rangeUnit), [rangeValue, rangeUnit]);

  const detectLocation = useCallback(async () => {
    setLocation({ status: 'loading' });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocation({ status: 'denied' });
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setLocation({ status: 'ready', latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      setLocation({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults({ status: 'idle' });
      detectLocation();
    }
  }, [visible, detectLocation]);

  const runSearch = useCallback(
    async (latitude: number, longitude: number, searchQuery: string, radius: number) => {
      setResults({ status: 'loading' });
      try {
        const params = { latitude, longitude, radiusKm: radius, query: searchQuery.trim() || undefined };
        const items: NearbyResult[] = isWorker
          ? await workersService.searchNearby(params)
          : await businessesService.searchNearby(params);
        setResults({ status: 'ready', items });
      } catch {
        setResults({ status: 'error' });
      }
    },
    [isWorker],
  );

  const readyLatitude = location.status === 'ready' ? location.latitude : null;
  const readyLongitude = location.status === 'ready' ? location.longitude : null;

  useEffect(() => {
    if (readyLatitude == null || readyLongitude == null || radiusKm == null) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(readyLatitude, readyLongitude, query, radiusKm);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [readyLatitude, readyLongitude, query, radiusKm, runSearch]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const renderItem = ({ item }: { item: NearbyResult }) => {
    const worker = isWorkerResult(mode, item) ? item : null;
    const business = !worker ? (item as BusinessNearbyResult) : null;
    const title = worker ? worker.accountFullName : (business as BusinessNearbyResult).shopName;
    const fixedTags = worker
      ? worker.skillCategories.filter((key) => key !== 'other')
      : (business as BusinessNearbyResult).shopCategories.filter((key) => key !== 'other');
    const customTags = worker
      ? worker.otherSkillDescription?.split(', ').filter(Boolean) ?? []
      : (business as BusinessNearbyResult).otherCategoryDescription?.split(', ').filter(Boolean) ?? [];

    return (
      <Pressable
        style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setSelectedResult(item)}
      >
        <View style={styles.resultHeaderRow}>
          <LinearGradient
            colors={isWorker ? headerGradient : SHOP_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.resultAvatar}
          >
            <FontAwesome6 name={isWorker ? 'screwdriver-wrench' : 'store'} size={18} color="#FFFFFF" solid />
          </LinearGradient>
          <View style={styles.resultHeaderInfo}>
            <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            {worker ? (
              <Text style={[styles.resultMetaText, { color: colors.textMuted }]}>
                {t('services.experienceYears', { count: worker.experienceYears })}
              </Text>
            ) : null}
          </View>
          <View style={[styles.distancePill, { backgroundColor: `${accentColor}16` }]}>
            <FontAwesome6 name="location-dot" size={13} color={accentColor} solid />
            <Text style={[styles.distanceText, { color: accentColor }]}>
              {t('nearbySearch.distanceAway', { distance: formatDistanceValue(item.distanceMeters) })}
            </Text>
          </View>
        </View>

        <View style={styles.tagRow}>
          {fixedTags.map((key) => (
            <View key={key} style={[styles.tag, { backgroundColor: `${accentColor}14` }]}>
              <Text style={[styles.tagText, { color: accentColor }]}>
                {t(worker ? `workerProfile.skills.${key}` : `businessProfile.categories.${key}`)}
              </Text>
            </View>
          ))}
          {customTags.map((entry) => (
            <View key={entry} style={[styles.tag, { backgroundColor: `${accentColor}14` }]}>
              <Text style={[styles.tagText, { color: accentColor }]} numberOfLines={1}>
                {entry}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.resultMetaRow}>
          <FontAwesome6 name="map" size={11} color={colors.textMuted} solid />
          <Text style={[styles.resultMetaText, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>
            {formatAddress(item)}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderBody = () => {
    if (location.status === 'idle' || location.status === 'loading') {
      return (
        <View style={styles.body}>
          <LoadingIndicator size={40} dotSize={6} color={accentColor} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('nearbySearch.detectingLocationTitle')}</Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{t('nearbySearch.detectingLocationMessage')}</Text>
        </View>
      );
    }

    if (location.status === 'denied' || location.status === 'error') {
      return (
        <View style={styles.body}>
          <View style={[styles.emptyIcon, { backgroundColor: `${colors.error}1A` }]}>
            <FontAwesome6 name="location-crosshairs" size={22} color={colors.error} solid />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t(location.status === 'denied' ? 'nearbySearch.locationDeniedTitle' : 'nearbySearch.locationErrorTitle')}
          </Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>
            {t(location.status === 'denied' ? 'nearbySearch.locationDeniedMessage' : 'nearbySearch.locationErrorMessage')}
          </Text>
          <Pressable style={[styles.retryButton, { backgroundColor: accentColor }]} onPress={detectLocation}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      );
    }

    if (radiusKm == null) {
      return (
        <View style={styles.body}>
          <View style={[styles.emptyIcon, { backgroundColor: `${colors.warning}1A` }]}>
            <FontAwesome6 name="ruler" size={22} color={colors.warning} solid />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('nearbySearch.invalidRangeTitle')}</Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{t('nearbySearch.invalidRangeMessage')}</Text>
        </View>
      );
    }

    if (results.status === 'idle' || results.status === 'loading') {
      return (
        <View style={styles.body}>
          <LoadingIndicator size={40} dotSize={6} color={accentColor} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('nearbySearch.searchingTitle')}</Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{t('nearbySearch.searchingMessage')}</Text>
        </View>
      );
    }

    if (results.status === 'error') {
      return (
        <View style={styles.body}>
          <View style={[styles.emptyIcon, { backgroundColor: `${colors.error}1A` }]}>
            <FontAwesome6 name="triangle-exclamation" size={22} color={colors.error} solid />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('common.errorTitle')}</Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{t('nearbySearch.resultsErrorMessage')}</Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: accentColor }]}
            onPress={() =>
              location.status === 'ready' && runSearch(location.latitude, location.longitude, query, radiusKm)
            }
          >
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      );
    }

    if (results.items.length === 0) {
      return (
        <View style={styles.body}>
          <View style={[styles.emptyIcon, { backgroundColor: `${accentColor}1A` }]}>
            <FontAwesome6 name={isWorker ? 'screwdriver-wrench' : 'store'} size={22} color={accentColor} solid />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t(isWorker ? 'nearbySearch.noResultsWorkersTitle' : 'nearbySearch.noResultsShopsTitle')}
          </Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>
            {t(isWorker ? 'nearbySearch.noResultsWorkersMessage' : 'nearbySearch.noResultsShopsMessage')}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={results.items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={handleClose} accessibilityLabel={t('common.cancel')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.titleGroup}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {t(isWorker ? 'nearbySearch.workersTitle' : 'nearbySearch.shopsTitle')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t(isWorker ? 'nearbySearch.workersSubtitle' : 'nearbySearch.shopsSubtitle')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.filterRow}>
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FontAwesome6 name="magnifying-glass" size={14} color={colors.textMuted} solid />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t(isWorker ? 'nearbySearch.searchWorkersPlaceholder' : 'nearbySearch.searchShopsPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.text }]}
              returnKeyType="search"
            />
          </View>
          <View style={[styles.radiusInputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              value={rangeValue}
              onChangeText={(text) => setRangeValue(text.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder={DEFAULT_RANGE_VALUE}
              placeholderTextColor={colors.textMuted}
              style={[styles.radiusInput, { color: colors.text }]}
            />
          </View>
          <Pressable
            style={[styles.unitButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setUnitPickerVisible(true)}
          >
            <Text style={[styles.unitButtonText, { color: colors.text }]}>{t(`nearbySearch.unit.${rangeUnit}`)}</Text>
            <FontAwesome6 name="chevron-down" size={10} color={colors.textMuted} solid />
          </Pressable>
        </View>

        {renderBody()}
      </View>

      <Modal visible={unitPickerVisible} transparent animationType="fade" onRequestClose={() => setUnitPickerVisible(false)} statusBarTranslucent>
        <Pressable style={styles.unitOverlay} onPress={() => setUnitPickerVisible(false)}>
          <Pressable style={[styles.unitCard, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.unitCardTitle, { color: colors.text }]}>{t('nearbySearch.rangeLabel')}</Text>
            {RANGE_UNITS.map((unit) => {
              const active = unit === rangeUnit;
              return (
                <Pressable
                  key={unit}
                  style={[styles.unitOption, { borderColor: active ? accentColor : colors.border, borderWidth: active ? 2 : 1 }]}
                  onPress={() => {
                    setRangeUnit(unit);
                    setUnitPickerVisible(false);
                  }}
                >
                  <Text style={[styles.unitOptionText, { color: active ? accentColor : colors.text }]}>
                    {t(`nearbySearch.unit.${unit}`)}
                  </Text>
                  {active ? <FontAwesome6 name="check" size={13} color={accentColor} solid /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <NearbyResultDetailModal
        visible={selectedResult !== null}
        onClose={() => setSelectedResult(null)}
        mode={mode}
        result={selectedResult}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  titleGroup: { marginLeft: 14, flex: 1 },
  headerTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', lineHeight: 20 },
  headerSubtitle: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 14, marginTop: 2 },
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
  // Search input, range input, and the unit picker trigger all share one row per
  // explicit request — search takes the remaining space (flex: 1), the other two are
  // narrow, fixed-width controls sized just for their short content.
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchInput: { flex: 1, ...typography.body, fontSize: 14, padding: 0 },
  radiusInputWrap: {
    width: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 11,
  },
  radiusInput: { ...typography.body, fontSize: 14, padding: 0, textAlign: 'center' },
  unitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  unitButtonText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13 },
  unitOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  unitCard: { width: '100%', maxWidth: 320, borderRadius: 18, padding: 18 },
  unitCardTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginBottom: 12, textAlign: 'center' },
  unitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 10,
  },
  unitOptionText: { ...typography.body, fontFamily: fonts.semiBold },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginBottom: 8, textAlign: 'center', marginTop: 16 },
  emptyMessage: { ...typography.body, textAlign: 'center', lineHeight: 20 },
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryButtonText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  listContent: { padding: 20, paddingBottom: 40 },
  resultCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  resultHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  resultAvatar: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resultHeaderInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  resultTitle: { ...typography.body, fontFamily: fonts.semiBold },
  resultMetaText: { ...typography.caption, marginTop: 2 },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  distanceText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  tagText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 11 },
  resultMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
});
