import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { LoadingIndicator } from './LoadingIndicator';
import { useAcceptBookingOffer, useBookingOffers, useDeclineBookingOffer } from '@/hooks/useBookingOffers';
import { useShopOrderAction, useShopOrders } from '@/hooks/useShopOrders';
import { shopOrdersService } from '@/services/shopOrdersService';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { jobQueryKey } from '@/hooks/useJobs';
import { jobsService } from '@/services/jobsService';
import { ApiError } from '@/services/apiClient';
import { PendingOffer } from '@/services/bookingOffersService';
import { ShopOrder } from '@/services/shopOrdersService';
import { useAuthStore } from '@/state/authStore';
import { usePendingOfferStore } from '@/state/pendingOfferStore';
import { useIncomingStore } from '@/state/incomingStore';
import { openJob } from '@/state/jobFocusStore';
import { openShopOrder, useShopOrderFocusStore } from '@/state/shopOrderFocusStore';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { formatDistance } from '@/utils/formatDistance';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

// A request this fresh when the app first loads still pops up (the push may have been missed).
const FRESH_OFFER_MS = 90 * 1000;
const FRESH_ORDER_MS = 2 * 60 * 1000;
// Lets the job / order screen finish fading in on top before this one closes underneath it.
const MODAL_HANDOFF_MS = 350;
const ACCEPT_GRADIENT = ['#16A34A', '#22C55E'] as const;
const PREVIEW_ITEMS = 3;

type Incoming = { key: string; type: 'job' | 'order'; id: string; createdAt: string };

/**
 * Decides which incoming-request screen opens (mounted once at the app root). A partner with
 * both a worker profile and a shop can get a job and an order at the same moment — instead of
 * one takeover after another, they're shown together:
 *  - one new request on its own → its own takeover (IncomingJobModal / IncomingOrderModal);
 *  - two or more at once, or a new one while a takeover is up → one "New requests" list, each
 *    with its own buttons. Anything left stays in Bookings and on Home.
 */
export function IncomingRequestsHub() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { data: offers, refetch: refetchOffers } = useBookingOffers();
  const shopQuery = useMyBusinessProfile(!!accessToken);
  const shop = shopQuery.data;
  const { data: orders } = useShopOrders(!!shop);
  const focusedJob = usePendingOfferStore((state) => state.focusedBookingRequestId);
  const autoAccept = usePendingOfferStore((state) => state.autoAccept);
  const orderId = useIncomingStore((state) => state.orderId);
  const listOpen = useIncomingStore((state) => state.listOpen);
  const placed = useMemo(() => (orders ?? []).filter((order) => order.status === 'placed'), [orders]);
  const offersReady = offers !== undefined;
  const ordersReady = shopQuery.isFetched && (!shop || orders !== undefined);
  const seenRef = useRef<Set<string> | null>(null);

  const showAll = () => {
    usePendingOfferStore.getState().clearFocusedOffer();
    useIncomingStore.getState().openList();
  };

  useEffect(() => {
    if (!accessToken) {
      seenRef.current = null;
      useIncomingStore.getState().clearOrder();
      useIncomingStore.getState().closeList();
      return;
    }
    if (!offersReady || !ordersReady) return;
    const items: Incoming[] = [
      ...(offers ?? []).map((offer) => ({
        key: `job:${offer.bookingRequestId}`,
        type: 'job' as const,
        id: offer.bookingRequestId,
        createdAt: offer.createdAt,
      })),
      ...placed.map((order) => ({ key: `order:${order.id}`, type: 'order' as const, id: order.id, createdAt: order.createdAt })),
    ];
    let fresh: Incoming[];
    if (seenRef.current === null) {
      seenRef.current = new Set(items.map((item) => item.key));
      fresh = items.filter(
        (item) => Date.now() - new Date(item.createdAt).getTime() < (item.type === 'job' ? FRESH_OFFER_MS : FRESH_ORDER_MS),
      );
    } else {
      const seen = seenRef.current;
      fresh = items.filter((item) => !seen.has(item.key));
      items.forEach((item) => seen.add(item.key));
    }

    const incoming = useIncomingStore.getState();
    const pending = usePendingOfferStore.getState();
    // Already on screen (a push opened it before the list caught up) — not new.
    const others = fresh.filter(
      (item) =>
        !(item.type === 'job' && item.id === pending.focusedBookingRequestId) && !(item.type === 'order' && item.id === incoming.orderId),
    );
    if (others.length === 0) return;
    Vibration.vibrate([0, 400, 200, 400]);
    // The list is open: it already shows the new one.
    if (incoming.listOpen) return;
    // Mid-accept on a job: let it finish; the rest are waiting in Bookings and on Home.
    if (incoming.jobBusy || pending.autoAccept) return;
    const showing = pending.focusedBookingRequestId !== null || incoming.orderId !== null;
    if (showing || others.length > 1) {
      showAll();
      return;
    }
    const only = others[0];
    if (only.type === 'job') pending.setFocusedOffer(only.id);
    // Don't pop up over that order's own screen.
    else if (useShopOrderFocusStore.getState().orderId !== only.id) incoming.focusOrder(only.id);
  }, [accessToken, offers, placed, offersReady, ordersReady]);

  // A job opened by a push or a notification tap while something else is up joins the list.
  useEffect(() => {
    if (!focusedJob) return;
    seenRef.current?.add(`job:${focusedJob}`);
    const incoming = useIncomingStore.getState();
    if (autoAccept) {
      // Accept was tapped on the notification: that job's own screen does it.
      if (incoming.listOpen) incoming.closeList();
      return;
    }
    if (incoming.listOpen || incoming.orderId) {
      showAll();
      refetchOffers();
    }
  }, [focusedJob, autoAccept, refetchOffers]);

  useEffect(() => {
    if (orderId) seenRef.current?.add(`order:${orderId}`);
  }, [orderId]);

  return <IncomingRequestsList visible={listOpen} offers={offers ?? []} orders={placed} />;
}

function IncomingRequestsList({ visible, offers, orders }: { visible: boolean; offers: PendingOffer[]; orders: ShopOrder[] }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const closeList = useIncomingStore((state) => state.closeList);
  const acceptMutation = useAcceptBookingOffer();
  const declineMutation = useDeclineBookingOffer();
  const declineOrder = useShopOrderAction(({ id }: { id: string }) => shopOrdersService.decline(id));
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [handingOff, setHandingOff] = useState(false);
  const count = offers.length + orders.length;
  const busy = acceptingId !== null || handingOff;

  // Everything answered (or taken / expired meanwhile): nothing left to show.
  useEffect(() => {
    if (visible && count === 0 && !busy) closeList();
  }, [visible, count, busy, closeList]);

  useEffect(() => {
    if (!visible) {
      setAcceptingId(null);
      setDecliningId(null);
      setHandingOff(false);
    }
  }, [visible]);

  const handOff = (open: () => void) => {
    setHandingOff(true);
    open();
    setTimeout(() => {
      closeList();
      setHandingOff(false);
    }, MODAL_HANDOFF_MS);
  };

  const accept = (id: string) => {
    setAcceptingId(id);
    acceptMutation.mutate(id, {
      onSuccess: async () => {
        Notifications.dismissNotificationAsync(id).catch(() => {});
        await queryClient.prefetchQuery({ queryKey: jobQueryKey(id), queryFn: () => jobsService.get(id) }).catch(() => {});
        showToast({ variant: 'success', title: t('bookings.acceptedToastTitle'), message: t('bookings.acceptedToastMessage') });
        handOff(() => openJob(id));
        setAcceptingId(null);
      },
      onError: (err) => {
        const alreadyTaken = err instanceof ApiError && err.code === 'BOOKING_ALREADY_TAKEN';
        showToast({
          variant: alreadyTaken ? 'info' : 'error',
          title: t(alreadyTaken ? 'bookings.takenToastTitle' : 'common.errorTitle'),
          message: alreadyTaken ? t('bookings.takenToastMessage') : getLocalizedErrorMessage(err, t),
        });
        if (alreadyTaken) Notifications.dismissNotificationAsync(id).catch(() => {});
        setAcceptingId(null);
      },
    });
  };

  const decline = (id: string) => {
    setDecliningId(id);
    declineMutation.mutate(id, {
      onSuccess: () => showToast({ variant: 'info', title: t('bookings.declinedToastTitle') }),
      onError: () => showToast({ variant: 'error', title: t('common.errorTitle'), message: t('errors.generic') }),
      onSettled: () => {
        Notifications.dismissNotificationAsync(id).catch(() => {});
        setDecliningId(null);
      },
    });
  };

  const declineShopOrder = (id: string) => {
    setDecliningId(id);
    declineOrder.mutate(
      { id },
      {
        onSuccess: () => showToast({ variant: 'info', title: t('shopOrders.declinedToast') }),
        onError: (err) => showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(err, t) }),
        onSettled: () => setDecliningId(null),
      },
    );
  };

  const renderDecline = (onPress: () => void, declining: boolean) => (
    <Pressable
      onPress={onPress}
      disabled={busy || declining}
      accessibilityRole="button"
      style={[
        styles.button,
        styles.outline,
        { borderColor: `${brandColors.error}59`, backgroundColor: `${brandColors.error}0D`, opacity: busy ? 0.4 : 1 },
      ]}
    >
      {declining ? (
        <LoadingIndicator color={brandColors.error} size={20} dotSize={4} />
      ) : (
        <>
          <FontAwesome6 name="xmark" size={14} color={brandColors.error} solid />
          <Text style={[styles.outlineText, { color: brandColors.error }]}>{t('bookings.decline')}</Text>
        </>
      )}
    </Pressable>
  );

  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  const renderTop = (icon: React.ComponentProps<typeof FontAwesome6>['name'], label: string, right: string) => (
    <View style={styles.cardTop}>
      <View style={[styles.typeIcon, { backgroundColor: `${colors.primary}14` }]}>
        <FontAwesome6 name={icon} size={14} color={colors.primary} solid />
      </View>
      <Text style={[styles.typeLabel, { color: colors.primary }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.pill, { backgroundColor: `${colors.primary}10` }]}>
        <FontAwesome6 name="location-arrow" size={10} color={colors.primary} solid />
        <Text style={[styles.pillText, { color: colors.primary }]}>{right}</Text>
      </View>
    </View>
  );

  const renderPerson = (name: string, place: string | null | undefined) => (
    <>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {name}
      </Text>
      {place ? (
        <View style={styles.placeRow}>
          <FontAwesome6 name="location-dot" size={11} color={colors.textMuted} solid />
          <Text style={[styles.place, { color: colors.textMuted }]} numberOfLines={1}>
            {place}
          </Text>
        </View>
      ) : null}
    </>
  );

  const renderChips = (labels: string[]) =>
    labels.length > 0 ? (
      <View style={styles.chips}>
        {labels.map((label) => (
          <View key={label} style={[styles.chip, { backgroundColor: `${colors.primary}0F`, borderColor: `${colors.primary}2E` }]}>
            <Text style={[styles.chipText, { color: colors.primary }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    ) : null;

  const greenButton = (label: string, icon: React.ComponentProps<typeof FontAwesome6>['name'], onPress: () => void, loading: boolean, disabled: boolean) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[styles.acceptWrap, { opacity: disabled && !loading ? 0.5 : 1 }]}>
      <LinearGradient colors={ACCEPT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.button}>
        {loading ? (
          <LoadingIndicator size={20} dotSize={4} />
        ) : (
          <>
            <FontAwesome6 name={icon} size={14} color="#FFFFFF" solid />
            <Text style={styles.acceptText}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => !busy && closeList()} statusBarTranslucent>
      {visible ? <StatusBar style="light" /> : null}
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 18 }]}>
          <View style={[styles.blob, styles.blobOne]} />
          <View style={styles.kicker}>
            <View style={styles.kickerDot} />
            <Text style={styles.kickerText}>{t('incoming.kicker')}</Text>
          </View>
          <Text style={styles.headline}>{t('incoming.headline', { count })}</Text>
          <Text style={styles.caption}>{t('incoming.caption')}</Text>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {offers.map((offer) => {
            const accepting = acceptingId === offer.bookingRequestId;
            const declining = decliningId === offer.bookingRequestId;
            return (
              <View key={`job:${offer.bookingRequestId}`} style={cardStyle}>
                {renderTop(
                  offer.direct ? 'user-check' : 'bolt',
                  t(offer.direct ? 'newForYou.bookedYou' : 'newForYou.jobRequest'),
                  formatDistance(offer.distanceMeters),
                )}
                {renderPerson(offer.customerFullName, offer.locationAddress)}
                {renderChips(offer.skillCategories.map((key) => t(`workerProfile.skills.${key}`)))}
                <View style={styles.actions}>
                  {renderDecline(() => decline(offer.bookingRequestId), declining)}
                  {greenButton(t('bookings.accept'), 'check', () => accept(offer.bookingRequestId), accepting, busy || declining)}
                </View>
              </View>
            );
          })}

          {orders.map((order) => {
            const items = order.items.slice(0, PREVIEW_ITEMS).map((item) => [item.name, item.quantity, item.unit].filter(Boolean).join(' '));
            const more = order.items.length - PREVIEW_ITEMS;
            if (more > 0) items.push(t('shopOrders.moreItems', { count: more }));
            return (
              <View key={`order:${order.id}`} style={cardStyle}>
                {renderTop(
                  'basket-shopping',
                  `${t('newForYou.newOrder')} · ${t('shopOrders.itemsCount', { count: order.items.length })}`,
                  formatDistance(order.distanceMeters),
                )}
                {renderPerson(order.customerFullName, order.locationAddress)}
                <Text style={[styles.fulfillment, { color: colors.textMuted }]}>
                  {t(order.fulfillment === 'delivery' ? 'shopOrders.fulfillmentDelivery' : 'shopOrders.fulfillmentPickup')}
                </Text>
                {renderChips(items)}
                <View style={styles.actions}>
                  {renderDecline(() => declineShopOrder(order.id), decliningId === order.id)}
                  {greenButton(t('shopOrders.openOrder'), 'arrow-right', () => handOff(() => openShopOrder(order.id)), false, busy || decliningId === order.id)}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 14, borderTopColor: colors.border }]}>
          <Pressable
            onPress={closeList}
            disabled={busy}
            accessibilityRole="button"
            style={[styles.button, styles.outline, { borderColor: colors.border, opacity: busy ? 0.5 : 1 }]}
          >
            <Text style={[styles.outlineText, { color: colors.text }]}>{t('incoming.later')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 26,
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)' },
  blobOne: { width: 220, height: 220, top: -90, right: -70 },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 30,
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  kickerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  kickerText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 12, letterSpacing: 1, includeFontPadding: false },
  headline: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 28, lineHeight: 38, marginTop: 14, textAlign: 'center' },
  caption: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.medium, fontSize: 13.5, textAlign: 'center', marginTop: 2 },
  list: { padding: 16, gap: 14, paddingBottom: 24 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#0B2A5B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  typeIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { flex: 1, fontFamily: fonts.semiBold, fontSize: 13.5 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10, borderRadius: 13 },
  pillText: { fontFamily: fonts.semiBold, fontSize: 12, includeFontPadding: false },
  name: { fontFamily: fonts.semiBold, fontSize: 17 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  place: { ...typography.caption, fontSize: 13, flex: 1 },
  fulfillment: { ...typography.caption, fontSize: 13, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  chip: { height: 30, paddingHorizontal: 11, borderRadius: 15, borderWidth: 1, justifyContent: 'center', maxWidth: '100%' },
  chipText: { fontFamily: fonts.semiBold, fontSize: 12.5, includeFontPadding: false },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  button: { flex: 1, height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  outline: { borderWidth: 1.5 },
  outlineText: { ...typography.body, fontFamily: fonts.semiBold },
  acceptWrap: { flex: 1.3, borderRadius: 14, overflow: 'hidden' },
  acceptText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  footer: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
