import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './Button';
import { CategoryPicker } from './CategoryPicker';
import { ListPickerRow } from './ListPickerRow';
import { ToastHost } from './ToastHost';
import { addressFor } from './QuickBookModal';
import { useAdGate } from './Ads';
import { SHOP_CATEGORIES } from '@/constants/categories';
import { useListStore } from '@/state/listStore';
import { ApiError } from '@/services/apiClient';
import { CustomerOrder, OrderFulfillment, ordersService } from '@/services/ordersService';
import { MY_ORDERS_QUERY_KEY, orderQueryKey } from '@/hooks/useOrders';
import { usePayHint, withFee } from '@/hooks/useSubscription';
import { payIfNeeded } from '@/state/payGateStore';
import { openOrderTracker } from '@/state/orderTrackerStore';
import { showToast } from '@/state/toastStore';
import { ensureLocation } from '@/state/locationStore';
import { askForLocation } from '@/utils/ensureLocationOn';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

// Lets the tracker finish fading in on top before this screen closes underneath it.
const MODAL_HANDOFF_MS = 350;

interface QuickOrderModalProps {
  visible: boolean;
  onClose: () => void;
  /** No lists yet: go and make one (the Prepare List tab). */
  onCreateList: () => void;
}

/**
 * Home's Quick Order — the shop side of Quick Book. Pick one of your lists, the kind of shop
 * and Pickup or Home Delivery, then Order Nearby: every verified shop of that kind nearby (that
 * delivers, for a delivery) gets it at once, and the first to accept gets the order — after
 * that it is an ordinary order, tracked on the order screen.
 */
export function QuickOrderModal({ visible, onClose, onCreateList }: QuickOrderModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const orderFee = usePayHint('order');
  const lists = useListStore((state) => state.lists);
  const [listId, setListId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  // Home delivery first: it's what people want most from a quick order.
  const [fulfillment, setFulfillment] = useState<OrderFulfillment>('delivery');
  const { waitForAd } = useAdGate(visible, 'send_list');

  useEffect(() => {
    if (!visible) return;
    setListId(useListStore.getState().lists[0]?.id ?? null);
    setCategories([]);
    setFulfillment('delivery');
  }, [visible]);

  const list = lists.find((entry) => entry.id === listId) ?? null;
  const items = (list?.items ?? []).filter((item) => item.name.trim().length > 0);

  const order = async () => {
    if (!list || items.length === 0 || categories.length === 0) return;
    // Location first, then the ad, then the fee (no plan) — and only then the order goes.
    if (!(await askForLocation())) return;
    if (!(await waitForAd())) return;
    if (!(await payIfNeeded('order'))) return;
    const here = await ensureLocation();
    if (!here) {
      showToast({ variant: 'error', title: t('location.requiredTitle'), message: t('location.requiredMessage') });
      return;
    }
    try {
      const created = await ordersService.createQuick({
        shopCategories: categories,
        fulfillment,
        items: items.map((item) => ({ name: item.name.trim(), quantity: item.quantity.trim() || '1', unit: item.unit.trim() || null })),
        latitude: here.latitude,
        longitude: here.longitude,
        locationAddress: fulfillment === 'delivery' ? await addressFor(here.latitude, here.longitude) : undefined,
      });
      // The tracker opens on it at once; My Orders, Continue and the Bazaar count too.
      queryClient.setQueryData(orderQueryKey(created.id), created);
      queryClient.setQueryData<CustomerOrder[]>(MY_ORDERS_QUERY_KEY, (current) => [
        created,
        ...(current ?? []).filter((entry) => entry.id !== created.id),
      ]);
      queryClient.invalidateQueries({ queryKey: MY_ORDERS_QUERY_KEY });
      showToast({ variant: 'success', title: t('quickOrder.sentTitle'), message: t('quickOrder.sentMessage') });
      openOrderTracker(created.id);
      setTimeout(onClose, MODAL_HANDOFF_MS);
    } catch (error) {
      const none = error instanceof ApiError && error.code === 'QUICK_ORDER_NO_SHOPS';
      showToast({
        variant: none ? 'info' : 'error',
        title: none ? t('quickOrder.noShopsTitle') : t('common.errorTitle'),
        message: none
          ? t(fulfillment === 'delivery' ? 'quickOrder.noShopsDelivery' : 'quickOrder.noShopsMessage')
          : getLocalizedErrorMessage(error, t),
      });
    }
  };

  const renderStepTitle = (number: number, title: string) => (
    <View style={styles.stepTitleRow}>
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </LinearGradient>
      <Text style={[styles.stepTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );

  const fulfillmentOption = (value: OrderFulfillment, icon: React.ComponentProps<typeof FontAwesome6>['name'], label: string, hint: string) => {
    const active = fulfillment === value;
    return (
      <Pressable key={value} style={styles.flex} onPress={() => setFulfillment(value)} accessibilityState={{ selected: active }}>
        {active ? (
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.option}>
            <FontAwesome6 name={icon} size={18} color="#FFFFFF" solid />
            <Text style={[styles.optionTitle, { color: '#FFFFFF' }]}>{label}</Text>
            <Text style={[styles.optionHint, { color: 'rgba(255,255,255,0.85)' }]}>{hint}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.option, styles.optionOff, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <FontAwesome6 name={icon} size={18} color={colors.primary} solid />
            <Text style={[styles.optionTitle, { color: colors.text }]}>{label}</Text>
            <Text style={[styles.optionHint, { color: colors.textMuted }]}>{hint}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.back')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.headerTitle}>{t('quickOrder.title')}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t('quickOrder.subtitle')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {lists.length === 0 ? (
          <View style={styles.empty}>
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyIcon}>
              <FontAwesome6 name="list-check" size={28} color="#FFFFFF" solid />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('chooseList.emptyTitle')}</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('quickOrder.noListMessage')}</Text>
            <View style={styles.emptyAction}>
              <Button label={t('chooseList.create')} onPress={onCreateList} />
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={[styles.intro, { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}2E` }]}>
              <FontAwesome6 name="bolt" size={15} color={colors.primary} solid />
              <Text style={[styles.introText, { color: colors.text }]}>{t('quickOrder.intro')}</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {renderStepTitle(1, t('quickOrder.stepList'))}
              {/* One sideways row of small cards; the chosen list's items underneath. */}
              <ListPickerRow lists={lists} selectedId={listId} onSelect={setListId} />
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {renderStepTitle(2, t('quickOrder.stepShop'))}
              <CategoryPicker
                title={t('homeSearch.filters.shopType')}
                placeholder={t('quickOrder.shopPlaceholder')}
                options={SHOP_CATEGORIES.map((entry) => ({
                  key: entry.key,
                  label: t(`businessProfile.categories.${entry.key}`),
                  icon: entry.icon,
                }))}
                selected={categories}
                onChange={setCategories}
                fieldIcon="store"
              />
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {renderStepTitle(3, t('quickOrder.stepHow'))}
              <View style={styles.options}>
                {fulfillmentOption('delivery', 'truck', t('quickOrder.delivery'), t('quickOrder.deliveryHint'))}
                {fulfillmentOption('pickup', 'person-walking', t('quickOrder.pickup'), t('quickOrder.pickupHint'))}
              </View>
            </View>
          </ScrollView>
        )}

        {lists.length > 0 ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <Button
              label={withFee(t('quickOrder.orderNearby'), orderFee)}
              onPress={order}
              disabled={!list || items.length === 0 || categories.length === 0}
            />
          </View>
        ) : null}
        <ToastHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
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
  body: { padding: 20, gap: 14, paddingBottom: 32 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 14 },
  introText: { ...typography.body, fontSize: 13.5, lineHeight: 19, flex: 1 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  stepNumber: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 12, includeFontPadding: false },
  stepTitle: { ...typography.body, fontFamily: fonts.semiBold },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  listName: { ...typography.body, fontFamily: fonts.semiBold },
  listMeta: { ...typography.caption, fontSize: 12, marginTop: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  options: { flexDirection: 'row', gap: 10 },
  option: { borderRadius: 16, padding: 14, gap: 6, minHeight: 104 },
  optionOff: { borderWidth: 1 },
  optionTitle: { ...typography.body, fontFamily: fonts.semiBold },
  optionHint: { ...typography.caption, fontSize: 11.5, lineHeight: 15 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { ...typography.subheading, fontFamily: fonts.semiBold, textAlign: 'center' },
  emptyText: { ...typography.body, textAlign: 'center', lineHeight: 21 },
  emptyAction: { alignSelf: 'stretch', marginTop: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
});
