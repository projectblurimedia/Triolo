import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AutoScrollText } from './AutoScrollText';
import { LoadingIndicator } from './LoadingIndicator';
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

// `mode` is tagged onto the ready state itself, not just trusted to match the component's
// current `mode` prop — see the render-race note below on why that distinction is load-
// bearing, not decorative.
type ResultsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: NearbyResult[]; mode: NearbySearchMode };

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
// Bounds how long a search or a GPS fix is allowed to sit on the loading spinner before
// surfacing as a retryable error — a hung request (a slow Vercel cold start, a stuck GPS
// fix indoors, ...) would otherwise leave the UI showing "Searching Nearby..." forever,
// since axios's own default timeout (45s, see apiClient.ts) is far longer than anyone would
// wait before assuming the app is broken, and expo-location's getCurrentPositionAsync has
// no timeout option of its own to lean on here.
const SEARCH_TIMEOUT_MS = 15000;
const LOCATION_TIMEOUT_MS = 15000;

function toRadiusKm(value: string, unit: RangeUnit): number | null {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const km = unit === 'km' ? parsed : parsed / 1000;
  return Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, km));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// Module-level, not component state — survives even if `NearbySearchModal` itself
// unmounts and remounts between opens (e.g. leaving and returning to the Home tab, or any
// other remount path upstream of this component that a purely in-component "skip refetch
// if already ready" check can't see across). Reused for the lifetime of the JS process;
// there's no TTL, since a stale-by-a-few-minutes fix is still far more useful here than
// forcing every reopen through a multi-second GPS round trip again.
let cachedLocation: { latitude: number; longitude: number } | null = null;

/**
 * Opened from Home's menu ("Nearby Workers" / "Nearby Shops") — full-screen search UI,
 * same chrome pattern as WorkerProfileModal/BusinessProfileModal (gradient header, left
 * back button). Always the constant brand-blue `headerGradient` for both header and every
 * accent in the body (result avatars, distance pill, tags, `NearbyResultDetailModal`) in
 * **both** modes — an earlier pass gave `'business'` mode `SHOP_GRADIENT` (the orange
 * Business-capability color) on result cards/tags/the detail view specifically, which was
 * removed per explicit follow-up instruction; this modal never uses that orange anywhere,
 * matching the header's own long-standing rule.
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
 * explicit request — the unit-picker trigger has no chevron icon (removed per explicit
 * feedback), and the search box's own placeholder uses `AutoScrollText` instead of the
 * native `placeholder` prop, since the box is now narrow enough to genuinely clip the
 * longer placeholder strings — text that doesn't fit marquee-scrolls to reveal the rest
 * rather than staying permanently cut off. Tapping a result card opens `NearbyResultDetailModal` for a fuller,
 * read-only view of that profile.
 */
export function NearbySearchModal({ visible, onClose, mode }: NearbySearchModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [searchFieldWidth, setSearchFieldWidth] = useState(0);
  const [rangeValue, setRangeValue] = useState(DEFAULT_RANGE_VALUE);
  const [rangeUnit, setRangeUnit] = useState<RangeUnit>(DEFAULT_RANGE_UNIT);
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);
  const [location, setLocation] = useState<LocationState>(() =>
    cachedLocation ? { status: 'ready', ...cachedLocation } : { status: 'idle' },
  );
  const [results, setResults] = useState<ResultsState>({ status: 'idle' });
  const [selectedResult, setSelectedResult] = useState<NearbyResult | null>(null);
  const isWorker = mode === 'worker';
  const accentColor = colors.primary;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const radiusKm = useMemo(() => toRadiusKm(rangeValue, rangeUnit), [rangeValue, rangeUnit]);
  // Bumped on every new detectLocation()/runSearch() call — a stale call's own result is
  // dropped if a newer one has since started, so an old, slow-to-settle request (network or
  // GPS) can never overwrite state a fresher request already set. Two independent counters
  // since location and search requests aren't the same operation.
  const locationRequestIdRef = useRef(0);
  const searchRequestIdRef = useRef(0);

  const detectLocation = useCallback(async () => {
    const requestId = ++locationRequestIdRef.current;
    setLocation({ status: 'loading' });
    try {
      const permission = await withTimeout(Location.requestForegroundPermissionsAsync(), LOCATION_TIMEOUT_MS);
      if (requestId !== locationRequestIdRef.current) return;
      if (!permission.granted) {
        setLocation({ status: 'denied' });
        return;
      }
      const position = await withTimeout(Location.getCurrentPositionAsync({}), LOCATION_TIMEOUT_MS);
      if (requestId !== locationRequestIdRef.current) return;
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      cachedLocation = next;
      setLocation({ status: 'ready', ...next });
    } catch {
      if (requestId !== locationRequestIdRef.current) return;
      setLocation({ status: 'error' });
    }
  }, []);

  // Read via a ref (not a `location` dependency) so this effect only fires on `visible`
  // transitions, never on every location-state change it causes. Skipping a fresh GPS fix
  // when one's already `ready` matters — re-detecting on every single reopen was reported as
  // "loading takes too long" whenever switching between Nearby Workers and Nearby Shops, a
  // full permission+GPS round trip even though the device hadn't moved. This ref-based check
  // alone wasn't enough, though: it only helps while this exact component instance stays
  // mounted, and something upstream of this component apparently *does* tear it down and
  // remount it between some opens (reported as specifically "whichever one is opened
  // second" is slow, regardless of which mode that is) — the module-level `cachedLocation`
  // above is what actually survives that, since a fresh instance's very first render already
  // seeds its `location` state from it instead of starting at `'idle'`.
  const locationRef = useRef(location);
  locationRef.current = location;

  // Bumped every time the modal actually opens — the debounced-search effect below includes
  // this in its dependency array specifically so a reopen always kicks off a fresh search,
  // even when every *other* input to that effect (location, query, radius, mode) happens to
  // be byte-for-byte identical to how they were left before closing. Without this, reopening
  // the *same* mode with an empty search box (the ordinary case — nothing left to reset)
  // changed nothing the debounce effect was actually watching, so it silently never re-ran:
  // `results` got reset to `'idle'` by the effect above, but nothing ever moved it past that,
  // leaving the UI stuck on the "Searching Nearby..." spinner indefinitely — reported as
  // "sometimes searching nearby workers or shops loading only, not getting."
  const [openGeneration, setOpenGeneration] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setResults({ status: 'idle' });
    setSelectedResult(null);
    setOpenGeneration((generation) => generation + 1);
    if (locationRef.current.status !== 'ready') {
      detectLocation();
    }
  }, [visible, detectLocation]);

  const runSearch = useCallback(
    async (latitude: number, longitude: number, searchQuery: string, radius: number) => {
      // Captured once, at the moment this specific search started — not re-read from the
      // component's `mode` prop after the request resolves, since `mode` can have already
      // moved on to the other tab by then (see the render-race note below).
      const searchedMode = mode;
      const requestId = ++searchRequestIdRef.current;
      setResults({ status: 'loading' });
      try {
        const params = { latitude, longitude, radiusKm: radius, query: searchQuery.trim() || undefined };
        const items = await withTimeout<NearbyResult[]>(
          isWorker ? workersService.searchNearby(params) : businessesService.searchNearby(params),
          SEARCH_TIMEOUT_MS,
        );
        // A newer search has since started (a keystroke, a range change, a mode switch) —
        // this one's answer is stale even if it did eventually succeed, so it must not
        // overwrite whatever the newer request already set (or is still waiting to set).
        if (requestId !== searchRequestIdRef.current) return;
        setResults({ status: 'ready', items, mode: searchedMode });
      } catch {
        if (requestId !== searchRequestIdRef.current) return;
        setResults({ status: 'error' });
      }
    },
    [isWorker, mode],
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openGeneration is a deliberate
    // extra trigger (see its own declaration above), not a value this effect reads.
  }, [readyLatitude, readyLongitude, query, radiusKm, runSearch, openGeneration]);

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
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.resultAvatar}>
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

    // Results tagged for the *other* mode are treated as not-ready-yet, same as idle/loading
    // — see the render-race note on ResultsState/runSearch above. Without this check, a
    // worker->shop (or shop->worker) switch could paint one frame of shop-mode `mode` with
    // still-in-state worker-shaped result objects passed to `renderItem`, which reads
    // shop-only fields (`shopCategories`, etc.) off them and throws — the crash then takes
    // the whole screen blank with it, since nothing in this app renders an error boundary.
    // That mismatch window is exactly what was reported as "shops sometimes blank page."
    if (results.status === 'idle' || results.status === 'loading' || (results.status === 'ready' && results.mode !== mode)) {
      return (
        <View style={styles.body}>
          <LoadingIndicator size={40} dotSize={6} color={accentColor} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t(isWorker ? 'nearbySearch.searchingWorkersTitle' : 'nearbySearch.searchingShopsTitle')}
          </Text>
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
            <View style={styles.searchInputWrap} onLayout={(e) => setSearchFieldWidth(e.nativeEvent.layout.width)}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                accessibilityLabel={t(
                  isWorker ? 'nearbySearch.searchWorkersPlaceholder' : 'nearbySearch.searchShopsPlaceholder',
                )}
                style={[styles.searchInput, { color: colors.text }]}
                returnKeyType="search"
              />
              {query.length === 0 && searchFieldWidth > 0 ? (
                <View style={styles.searchPlaceholderOverlay} pointerEvents="none">
                  <AutoScrollText
                    text={t(
                      isWorker ? 'nearbySearch.searchWorkersPlaceholder' : 'nearbySearch.searchShopsPlaceholder',
                    )}
                    containerWidth={searchFieldWidth}
                    style={[styles.searchPlaceholderText, { color: colors.textMuted }]}
                  />
                </View>
              ) : null}
            </View>
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
  // narrow, fixed-width controls sized just for their short content. marginBottom gives
  // the result list/body below it real breathing room — without it, the first scrolled
  // card sat flush against the row, per explicit feedback.
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
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
  // Wraps the TextInput plus its own AutoScrollText placeholder overlay (see below) — the
  // native `placeholder` prop can't marquee-scroll when the text is too long to fit, which
  // this search bar's now-narrower width (sharing a row with the range input/unit picker)
  // makes a real risk for the longer placeholder strings.
  searchInputWrap: { flex: 1, position: 'relative', justifyContent: 'center' },
  searchInput: { ...typography.body, fontSize: 14, padding: 0 },
  searchPlaceholderOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center' },
  searchPlaceholderText: { ...typography.body, fontSize: 14 },
  // Wide enough that a 5-digit meters value (e.g. "50000", 50km expressed in M) doesn't get
  // clipped — 52px was too narrow, per explicit feedback.
  radiusInputWrap: {
    width: 72,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 11,
  },
  radiusInput: { ...typography.body, fontSize: 14, padding: 0, textAlign: 'center' },
  unitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
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
  // No paddingTop — filterRow's own marginBottom already provides the gap above the list;
  // a top padding here on top of that doubled the space, per explicit feedback.
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
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
