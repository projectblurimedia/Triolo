import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { clean } from '@/utils/place';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Button } from './Button';
import { CategoryPicker } from './CategoryPicker';
import { useTrustedIds } from '@/hooks/useSubscription';
import { SHOP_CATEGORIES } from '@/constants/categories';
import { usePayHint, withFee } from '@/hooks/useSubscription';
import { payIfNeeded } from '@/state/payGateStore';
import { LoadingIndicator } from './LoadingIndicator';
import { RatingStars } from './RatingStars';
import { ToastHost } from './ToastHost';
import { Avatar } from './WorkerMiniCard';
import { useListStore } from '@/state/listStore';
import { ensureLocation } from '@/state/locationStore';
import { openOrderTracker } from '@/state/orderTrackerStore';
import { showToast } from '@/state/toastStore';
import { locationActionLabel, useDeviceLocation } from '@/hooks/useDeviceLocation';
import { useCreateOrder } from '@/hooks/useOrders';
import { SERVICES_RADIUS_KM } from '@/hooks/useNearbyWorkers';
import { BusinessNearbyResult, businessesService } from '@/services/businessesService';
import { formatRupees, OrderFulfillment } from '@/services/ordersService';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { formatDistanceValue } from '@/utils/nearbyResult';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { openNewList } from '@/navigation/navigationRef';
import { askForLocation } from '@/utils/ensureLocationOn';
import { useAdGate, useBusyAction } from './Ads';

interface SendListModalProps {
  visible: boolean;
  onClose: () => void;
  /** Opened from a shop's own profile: that shop is already chosen. */
  shop?: BusinessNearbyResult | null;
  /** The saved list to send; the customer can switch lists inside. Defaults to the newest. */
  listId?: string | null;
  /** Called when the person leaves to create a list, so a screen that opened this one can close too. */
  onLeave?: () => void;
}

const SHOP_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 350;
// "Top rated" keeps shops rated this many stars and up.
const TOP_RATED_MIN = 4;
const GEOCODE_TIMEOUT_MS = 4000;
// Lets the order screen finish fading in on top before this one closes underneath it.
const MODAL_HANDOFF_MS = 350;
const PREVIEW_ITEMS = 4;

/** Same rule as the backend: the shop's price per km × distance in whole rupees, never below its minimum charge. */
function estimateDeliveryCharge(shop: BusinessNearbyResult): number {
  const byDistance = Math.round(((shop.deliveryPricePerKm ?? 0) * shop.distanceMeters) / 1000);
  // Never less than the price of 1 km (or a larger minimum the shop saved).
  return Math.max(byDistance, Math.round(Math.max(shop.deliveryMinCharge ?? 0, shop.deliveryPricePerKm ?? 0)));
}

async function addressFor(latitude: number, longitude: number): Promise<string | undefined> {
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), GEOCODE_TIMEOUT_MS));
    const [place] = await Promise.race([Location.reverseGeocodeAsync({ latitude, longitude }), timeout]);
    if (!place) return undefined;
    // No Plus Codes or pincode — just the words the shop can read.
    const parts = [place.name, place.street, place.city ?? place.subregion]
      .map(clean)
      .filter((part, index, all) => !!part && all.indexOf(part) === index);
    return parts.join(', ') || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Send the prepared list to one nearby shop to pack (Prepare List's "Send to a Shop", Bazaar's
 * Quick Order, or a shop profile's "Order from this shop"). Shops can be filtered by category
 * and delivery, sorted nearest / top rated; then pickup or door delivery (only where the shop
 * delivers, with its charge shown up front), an optional note, Send. Location must be on.
 */
export function SendListModal({ visible, onClose, shop: preselected, listId: initialListId, onLeave }: SendListModalProps) {
  const { t } = useTranslation();
  const orderFee = usePayHint('order');
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const lists = useListStore((state) => state.lists);
  const [listId, setListId] = useState<string | null>(null);
  const currentList = lists.find((list) => list.id === listId) ?? lists[0] ?? null;
  const items = (currentList?.items ?? []).filter((item) => item.name.trim().length > 0);
  const { location, refresh: refreshLocation } = useDeviceLocation();
  const coords = location.status === 'ready' ? location : null;
  const createOrder = useCreateOrder();

  const [selected, setSelected] = useState<BusinessNearbyResult | null>(null);
  const [fulfillment, setFulfillment] = useState<OrderFulfillment>('pickup');
  // Search and filters right here, results just below (the same filters as the Bazaar search).
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [nearest, setNearest] = useState(false);
  const [topRated, setTopRated] = useState(false);
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [types, setTypes] = useState<string[]>([]);
  const trusted = useTrustedIds();
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelected(preselected ?? null);
    setListId(initialListId ?? useListStore.getState().lists[0]?.id ?? null);
    setFulfillment('pickup');
    setNote('');
    setSending(false);
    setInput('');
    setQuery('');
    setNearest(false);
    setTopRated(false);
    setTrustedOnly(false);
    setDeliveryOnly(false);
    setTypes([]);
  }, [visible, preselected, initialListId]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const typeKey = types.length > 0 ? types.join(',') : undefined;
  const sort: 'distance' | 'rating' = topRated && !nearest ? 'rating' : 'distance';

  const shops = useQuery({
    queryKey: ['businesses', 'nearby', 'send-list', coords?.latitude, coords?.longitude, query, typeKey, deliveryOnly, sort],
    queryFn: () =>
      businessesService.searchNearby({
        latitude: coords!.latitude,
        longitude: coords!.longitude,
        radiusKm: SERVICES_RADIUS_KM,
        limit: SHOP_LIMIT,
        query: query || undefined,
        // A kind is picked: the box looks for shop names within it.
        nameOnly: types.length > 0,
        shopCategory: typeKey,
        deliveryOnly,
        sort,
      }),
    enabled: visible && !preselected && coords !== null,
    staleTime: 60_000,
    // Keep the last results on screen while the next search loads (no flashing).
    placeholderData: (previous) => previous,
  });

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
        <View style={[styles.filterChip, styles.filterChipOff, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome6 name={icon} size={11} color={colors.primary} solid />
          <Text style={[styles.filterText, { color: colors.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );

  const choose = (shop: BusinessNearbyResult) => {
    setSelected(shop);
    if (!shop.deliveryAvailable) setFulfillment('pickup');
  };

  // Asking for location / showing the ad: a second tap must not send the list twice.
  const preparing = useRef(false);
  const { adLoading, waitForAd } = useAdGate(visible, 'send_list');
  const { busy, run } = useBusyAction();

  const handleSend = async () => {
    if (!selected || sending || preparing.current) return;
    preparing.current = true;
    try {
      // Location first, then a local business's ad (when one is running), then the order goes.
      if (!(await askForLocation())) return;
      if (!(await waitForAd())) return;
      // No plan: pay once at this last step — or subscribe.
      if (!(await payIfNeeded('order'))) return;
    } finally {
      preparing.current = false;
    }
    setSending(true);
    try {
      const here = await ensureLocation();
      if (!here) {
        showToast({ variant: 'error', title: t('location.requiredTitle'), message: t('location.requiredMessage') });
        return;
      }
      const locationAddress = fulfillment === 'delivery' ? await addressFor(here.latitude, here.longitude) : undefined;
      const order = await createOrder.mutateAsync({
        businessId: selected.id,
        fulfillment,
        items: items.map((item) => ({
          name: item.name.trim(),
          quantity: item.quantity.trim() || '1',
          unit: item.unit.trim() || null,
        })),
        latitude: here.latitude,
        longitude: here.longitude,
        locationAddress,
        note: note.trim() || undefined,
      });
      showToast({
        variant: 'success',
        title: t('sendList.sentTitle'),
        message: t('sendList.sentMessage', { shop: selected.shopName }),
      });
      openOrderTracker(order.id);
      setTimeout(onClose, MODAL_HANDOFF_MS);
    } catch (error) {
      showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
    } finally {
      setSending(false);
    }
  };

  const renderListPicker = () =>
    lists.length > 1 ? (
      <>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('sendList.chooseList')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {lists.map((list) =>
            renderChip(
              list.id,
              `${list.name} (${list.items.length})`,
              list.id === currentList?.id,
              () => setListId(list.id),
              'list-check',
            ),
          )}
        </ScrollView>
      </>
    ) : null;

  const renderListPreview = () => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {currentList?.name} · {t('sendList.yourList', { count: items.length })}
      </Text>
      {items.slice(0, PREVIEW_ITEMS).map((item, index) => (
        <View key={item.id} style={styles.previewRow}>
          <Text style={[styles.previewIndex, { color: colors.textMuted }]}>{index + 1}.</Text>
          <Text style={[styles.previewName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.previewQty, { color: colors.textMuted }]}>
            {[item.quantity, item.unit].filter(Boolean).join(' ')}
          </Text>
        </View>
      ))}
      {items.length > PREVIEW_ITEMS ? (
        <Text style={[styles.more, { color: colors.primary }]}>
          {t('sendList.more', { count: items.length - PREVIEW_ITEMS })}
        </Text>
      ) : null}
    </View>
  );

  const renderChip = (
    key: string,
    label: string,
    active: boolean,
    onPress: () => void,
    icon?: React.ComponentProps<typeof FontAwesome6>['name'],
  ) => (
    <Pressable key={key} onPress={onPress}>
      {active ? (
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
          {icon ? <FontAwesome6 name={icon} size={11} color="#FFFFFF" solid /> : null}
          <Text style={[styles.chipText, { color: '#FFFFFF' }]}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.chip, { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }]}>
          {icon ? <FontAwesome6 name={icon} size={11} color={colors.textMuted} solid /> : null}
          <Text style={[styles.chipText, { color: colors.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );

  const renderShop = (item: BusinessNearbyResult) => {
    const active = selected?.id === item.id;
    const categories = item.shopCategories
      .filter((key) => key !== 'other')
      .map((key) => t(`businessProfile.categories.${key}`))
      .join(', ');
    return (
      <Pressable
        onPress={() => choose(item)}
        style={[
          styles.card,
          styles.shopRow,
          {
            backgroundColor: colors.surface,
            borderColor: active ? colors.primary : colors.border,
            borderWidth: active ? 1.5 : 1,
          },
        ]}
      >
        <Avatar
          photoUrl={item.profilePhotoUrl}
          name={item.shopName}
          size={46}
          seal={{ kind: 'business', id: item.id }}
        />
        <View style={styles.flex}>
          <Text style={[styles.shopName, { color: colors.text }]} numberOfLines={1}>
            {item.shopName}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {categories}
          </Text>
          <View style={styles.metaRow}>
            <RatingStars average={item.ratingAverage} count={item.ratingCount} />
            <Text style={[styles.meta, { color: colors.primary }]}>· {formatDistanceValue(item.distanceMeters)}</Text>
            <Text style={[styles.meta, { color: item.deliveryAvailable ? brandColors.success : colors.textMuted }]}>
              · {t(item.deliveryAvailable ? 'sendList.delivers' : 'sendList.pickupOnly')}
            </Text>
          </View>
        </View>
        <View style={[styles.radio, { borderColor: active ? colors.primary : colors.border }]}>
          {active ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
        </View>
      </Pressable>
    );
  };

  const renderShops = () => {
    if (preselected) return null;
    if (!coords) {
      const blocked = location.status === 'denied' || location.status === 'disabled' || location.status === 'error';
      return (
        <View style={styles.state}>
          {blocked ? (
            <>
              <FontAwesome6 name="location-crosshairs" size={22} color={colors.textMuted} solid />
              <Text style={[styles.stateTitle, { color: colors.text }]}>{t('location.disabledTitle')}</Text>
              <View style={styles.stateAction}>
                <Button label={locationActionLabel(location, t)} onPress={refreshLocation} />
              </View>
            </>
          ) : (
            <LoadingIndicator size={32} dotSize={5} color={colors.primary} />
          )}
        </View>
      );
    }
    if (shops.isLoading) {
      return (
        <View style={styles.state}>
          <LoadingIndicator size={32} dotSize={5} color={colors.primary} />
        </View>
      );
    }
    const list = (shops.data ?? []).filter(
      (shop) =>
        (!trustedOnly || !!trusted.data?.business?.includes(shop.id)) && (!topRated || (shop.ratingAverage ?? 0) >= TOP_RATED_MIN),
    );
    if (list.length === 0) {
      return (
        <View style={styles.state}>
          <FontAwesome6 name="store-slash" size={22} color={colors.textMuted} solid />
          <Text style={[styles.stateTitle, { color: colors.text }]}>{t('sendList.noShops')}</Text>
        </View>
      );
    }
    return list.map((shop) => <View key={shop.id}>{renderShop(shop)}</View>);
  };

  const renderFooter = () => {
    if (!selected) return null;
    const delivers = selected.deliveryAvailable;
    const charge = estimateDeliveryCharge(selected);
    const option = (
      value: OrderFulfillment,
      icon: React.ComponentProps<typeof FontAwesome6>['name'],
      label: string,
      sub: string,
      disabled: boolean,
    ) => {
      const active = fulfillment === value;
      return (
        <Pressable
          disabled={disabled}
          onPress={() => setFulfillment(value)}
          style={[
            styles.option,
            {
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? `${colors.primary}10` : colors.surface,
              opacity: disabled ? 0.45 : 1,
            },
          ]}
        >
          <FontAwesome6 name={icon} size={15} color={active ? colors.primary : colors.textMuted} solid />
          <View style={styles.flex}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>{label}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{sub}</Text>
          </View>
        </Pressable>
      );
    };
    return (
      <View
        style={[
          styles.footer,
          { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 14 },
        ]}
      >
        <Text style={[styles.footerTitle, { color: colors.text }]} numberOfLines={1}>
          {t('sendList.sendTo', { shop: selected.shopName })}
        </Text>
        <View style={styles.options}>
          {option('pickup', 'store', t('sendList.pickup'), t('sendList.pickupSub'), false)}
          {option(
            'delivery',
            'truck',
            t('sendList.delivery'),
            delivers ? t('sendList.deliverySub', { amount: formatRupees(charge) }) : t('sendList.noDelivery'),
            !delivers,
          )}
        </View>
        <TextInput
          style={[styles.note, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          value={note}
          onChangeText={setNote}
          maxLength={300}
          placeholder={t('sendList.notePlaceholder')}
          placeholderTextColor={colors.textMuted}
        />
        <Button
          label={withFee(t('sendList.send', { count: items.length }), orderFee)}
          onPress={() => run(handleSend)}
          loading={sending || adLoading || busy}
        />
      </View>
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
            <Text style={styles.headerTitle}>{t('sendList.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('sendList.subtitle')}</Text>
          </View>
        </LinearGradient>

        {items.length === 0 ? (
          <View style={styles.state}>
            <FontAwesome6 name="list-check" size={26} color={colors.textMuted} solid />
            <Text style={[styles.stateTitle, { color: colors.text }]}>{t('sendList.emptyTitle')}</Text>
            <Text style={[styles.meta, styles.centerText, { color: colors.textMuted }]}>{t('sendList.emptyMessage')}</Text>
            <View style={styles.stateAction}>
              <Button
                label={t('sendList.createList')}
                onPress={() => {
                  onClose();
                  onLeave?.();
                  openNewList();
                }}
              />
            </View>
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            <View style={styles.gap}>
              {renderListPicker()}
              {renderListPreview()}
              {preselected ? null : (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('sendList.chooseShop')}</Text>
                  {/* Search and filters right here, in one card; the shops update just below. */}
                  {/* The page's own colour, so the card blends into the screen; light inputs on it. */}
                  <View style={[styles.filterCard, { backgroundColor: colors.background, borderColor: `${colors.primary}1F` }]}>
                  <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: `${colors.primary}26` }]}>
                    <FontAwesome6 name="magnifying-glass" size={14} color={colors.primary} solid />
                    <TextInput
                      style={[styles.searchInput, { color: colors.text }]}
                      value={input}
                      onChangeText={setInput}
                      placeholder={types.length > 0 ? t('homeSearch.filters.shopsNamePlaceholder') : t('sendList.searchShops')}
                      placeholderTextColor={colors.textMuted}
                      returnKeyType="search"
                      autoCorrect={false}
                    />
                    {input ? (
                      <Pressable onPress={() => setInput('')} hitSlop={8} accessibilityLabel={t('common.close')}>
                        <FontAwesome6 name="circle-xmark" size={15} color={colors.textMuted} solid />
                      </Pressable>
                    ) : null}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chipRow}>
                    {filterChip('nearest', t('services.sortNearest'), 'location-arrow', nearest, () => setNearest((on) => !on))}
                    {filterChip('rated', t('homeSearch.filters.topRated'), 'star', topRated, () => setTopRated((on) => !on))}
                    {filterChip('trusted', t('homeSearch.filters.trusted'), 'shield-halved', trustedOnly, () => setTrustedOnly((on) => !on))}
                    {filterChip('delivery', t('sendList.deliveryFilter'), 'truck', deliveryOnly, () => setDeliveryOnly((on) => !on))}
                  </ScrollView>
                  <CategoryPicker
                    title={t('homeSearch.filters.shopType')}
                    placeholder={t('homeSearch.filters.anyShop')}
                    options={SHOP_CATEGORIES.map((entry) => ({
                      key: entry.key,
                      label: t(`businessProfile.categories.${entry.key}`),
                      icon: entry.icon,
                    }))}
                    selected={types}
                    onChange={setTypes}
                    clearable
                    fieldIcon="filter"
                  />
                  </View>
                </>
              )}
              {renderShops()}
            </View>
          </ScrollView>
        )}

        {items.length > 0 ? renderFooter() : null}
        <ToastHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: fonts.regular, padding: 0 },
  filterCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    padding: 12,
    gap: 10,
    shadowColor: '#0B3A8A',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    // No Android elevation: it shows through translucent glass as a grey box (as on the tab bar).
  },
  chipRow: { gap: 8, paddingRight: 4 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, borderRadius: 17, paddingHorizontal: 13 },
  filterChipOff: { borderWidth: 1 },
  filterText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, includeFontPadding: false },
  container: { flex: 1 },
  flex: { flex: 1 },
  gap: { gap: 12 },
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
  body: { padding: 16, paddingBottom: 24 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  cardLabel: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  previewIndex: { ...typography.caption, width: 18 },
  previewName: { ...typography.body, fontSize: 14, flex: 1 },
  previewQty: { ...typography.caption, fontSize: 12 },
  more: { ...typography.caption, fontFamily: fonts.semiBold, marginTop: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { ...typography.body, fontFamily: fonts.semiBold },
  sortToggle: { flexDirection: 'row', borderRadius: 16, padding: 3 },
  sortOption: { borderRadius: 13, paddingHorizontal: 10, paddingVertical: 5 },
  sortLabel: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11 },
  chips: { gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 12 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shopName: { ...typography.body, fontFamily: fonts.semiBold },
  meta: { ...typography.caption, fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  state: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 24 },
  stateTitle: { ...typography.body, fontFamily: fonts.semiBold, textAlign: 'center' },
  stateAction: { alignSelf: 'stretch', marginTop: 4 },
  centerText: { textAlign: 'center' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  footerTitle: { ...typography.body, fontFamily: fonts.semiBold },
  options: { flexDirection: 'row', gap: 10 },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, padding: 12 },
  optionTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  note: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, ...typography.body, fontSize: 13 },
});
