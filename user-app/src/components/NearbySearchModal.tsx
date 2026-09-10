import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingIndicator } from './LoadingIndicator';
import { SHOP_GRADIENT } from './BusinessProfileModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { workersService, WorkerNearbyResult } from '@/services/workersService';
import { businessesService, BusinessNearbyResult } from '@/services/businessesService';
import { formatAddress } from '@/utils/formatAddress';

export type NearbySearchMode = 'worker' | 'business';

type NearbyResult = WorkerNearbyResult | BusinessNearbyResult;

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

// Per explicit request, the radius is now a user-facing filter instead of one fixed
// constant — options span the backend's validated range (0.1-50km), from a genuinely
// walkable 500m up to a district-wide 50km. Default lands on 10km, the same value this
// was fixed at before the filter existed.
const RADIUS_OPTIONS_KM = [0.5, 1, 5, 10, 25, 50];
const DEFAULT_RADIUS_KM = 10;
const SEARCH_DEBOUNCE_MS = 350;

/** "500m" under 1km, "10km" at or above it — same threshold/format `formatDistanceValue` uses for a result's own distance. */
function formatRadiusLabel(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km}km`;
}

/** "420m" for under a km, "1.3km" otherwise — matches the "500m away"/"1km far" phrasing from the feature request. */
function formatDistanceValue(meters: number): string {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function isWorkerResult(mode: NearbySearchMode, item: NearbyResult): item is WorkerNearbyResult {
  return mode === 'worker';
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
 * profiles within a user-chosen radius (`RADIUS_OPTIONS_KM` chip row below the search bar
 * — 500m up to 50km, defaulting to 10km), re-queried (debounced) whenever the free-text
 * search box or the selected radius changes. Replaces the earlier coming-soon placeholder
 * body.
 */
export function NearbySearchModal({ visible, onClose, mode }: NearbySearchModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [location, setLocation] = useState<LocationState>({ status: 'idle' });
  const [results, setResults] = useState<ResultsState>({ status: 'idle' });
  const isWorker = mode === 'worker';
  const accentColor = isWorker ? colors.primary : SHOP_GRADIENT[0];
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (readyLatitude == null || readyLongitude == null) return;
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
      <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
      </View>
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

        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome6 name="magnifying-glass" size={15} color={colors.textMuted} solid />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t(isWorker ? 'nearbySearch.searchWorkersPlaceholder' : 'nearbySearch.searchShopsPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            returnKeyType="search"
          />
        </View>

        <View style={styles.radiusRow}>
          <Text style={[styles.radiusLabel, { color: colors.textMuted }]}>{t('nearbySearch.rangeLabel')}</Text>
          <View style={styles.radiusChipRow}>
            {RADIUS_OPTIONS_KM.map((option) => {
              const active = option === radiusKm;
              return active ? (
                <Pressable key={option} onPress={() => setRadiusKm(option)}>
                  <LinearGradient
                    colors={isWorker ? headerGradient : SHOP_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.radiusChip}
                  >
                    <Text style={[styles.radiusChipText, { color: '#FFFFFF' }]}>{formatRadiusLabel(option)}</Text>
                  </LinearGradient>
                </Pressable>
              ) : (
                <Pressable
                  key={option}
                  onPress={() => setRadiusKm(option)}
                  style={[styles.radiusChip, styles.radiusChipInactive, { borderColor: colors.border }]}
                >
                  <Text style={[styles.radiusChipText, { color: colors.text }]}>{formatRadiusLabel(option)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {renderBody()}
      </View>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 16,
  },
  searchInput: { flex: 1, ...typography.body, padding: 0 },
  radiusRow: { marginHorizontal: 20, marginTop: 14 },
  radiusLabel: { ...typography.caption, fontFamily: fonts.medium, marginBottom: 8 },
  radiusChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  radiusChip: { borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14 },
  radiusChipInactive: { borderWidth: 1 },
  radiusChipText: { ...typography.caption, fontFamily: fonts.semiBold },
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
