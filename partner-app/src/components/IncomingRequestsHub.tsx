import React, { useEffect, useMemo, useRef, useState } from 'react';
import { placeName } from '@/utils/formatAddress';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { LoadingIndicator } from './LoadingIndicator';
import { NewForYou } from './NewForYou';
import { PullToRefresh } from './PullToRefresh';
import { BOOKING_OFFERS_QUERY_KEY, useAcceptBookingOffer, useBookingOffers, useDeclineBookingOffer } from '@/hooks/useBookingOffers';
import { SHOP_ORDERS_QUERY_KEY, useShopOrderAction, useShopOrders } from '@/hooks/useShopOrders';
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

type Incoming = {
  key: string;
  type: 'job' | 'order';
  id: string;
  createdAt: string;
};

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
  const queryClient = useQueryClient();

  // Any new job or order: the lists (Live Requests, Home) refresh straight away, not on the next
  // poll. Here (inside the QueryClientProvider), not in usePushNotifications, which runs above it.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const kind = (notification.request.content.data as { kind?: string } | undefined)?.kind;
      if (kind === 'booking_offer' || kind === 'booking_taken') queryClient.invalidateQueries({ queryKey: BOOKING_OFFERS_QUERY_KEY });
      if (kind === 'order_placed' || kind === 'order_cancelled') queryClient.invalidateQueries({ queryKey: SHOP_ORDERS_QUERY_KEY });
      // A new job or order while the app is open: Live Requests straight away (not on the next poll).
      if (kind === 'booking_offer' || kind === 'order_placed') {
        usePendingOfferStore.getState().clearFocusedOffer();
        useIncomingStore.getState().openList();
      }
    });
    return () => subscription.remove();
  }, [queryClient]);

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
      ...placed.map((order) => ({
        key: `order:${order.id}`,
        type: 'order' as const,
        id: order.id,
        createdAt: order.createdAt,
      })),
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
    // One screen for everything new: the swipe pile of every request waiting (not over the
    // order's own screen, when that one is the only new thing).
    const only = others.length === 1 ? others[0] : null;
    if (only && only.type === 'order' && useShopOrderFocusStore.getState().orderId === only.id) return;
    showAll();
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
    // A push or a notification tap: the swipe screen, with this job among the others.
    showAll();
    refetchOffers();
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
  const closeList = useIncomingStore((state) => state.closeList);
  const manual = useIncomingStore((state) => state.listManual);
  const [handingOff, setHandingOff] = useState(false);
  const count = offers.length + orders.length;
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  // Swiping the pile: the page holds still (no scroll, no pull-to-refresh).
  const [scrollLocked, setScrollLocked] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: BOOKING_OFFERS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: SHOP_ORDERS_QUERY_KEY }),
    ]);
    setRefreshing(false);
  };
  const pulse = useRef(new Animated.Value(0)).current;

  // Opened by new requests: closes itself once they're all answered (taken / expired meanwhile).
  // Opened from the menu: stays, saying there's nothing right now.
  useEffect(() => {
    if (visible && count === 0 && !handingOff && !manual) closeList();
  }, [visible, count, handingOff, manual, closeList]);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    pulse.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  // A job / order screen opens on top; this one closes under it.
  const handOff = () => {
    setHandingOff(true);
    setTimeout(() => {
      closeList();
      setHandingOff(false);
    }, MODAL_HANDOFF_MS);
  };

  const ring = (delay: number) => {
    const value = Animated.modulo(Animated.add(pulse, delay), 1);
    return {
      opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
      transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) }],
    };
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={closeList} statusBarTranslucent>
      {visible ? <StatusBar style="light" /> : null}
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* The usual compact header: back, title + subtitle, the LIVE pill. */}
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Pressable onPress={closeList} hitSlop={8} accessibilityLabel={t('common.close')} style={styles.closeButton}>
            <FontAwesome6 name="chevron-left" size={16} color="#FFFFFF" solid />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {t('incoming.menuTitle')}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {t('incoming.menuHint')}
            </Text>
          </View>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{t('incoming.live')}</Text>
          </View>
        </LinearGradient>

        {/* A fixed page (no scroll view): Android's scroll view kept the touch, so the cards couldn't be
            swiped. Everything fits; the list refreshes on its own every few seconds. */}
        <View style={[styles.body, styles.flex, { paddingBottom: insets.bottom + 16 }]}>
            {/* What's waiting, at a glance: the radar with the count, and jobs / orders. */}
            <LinearGradient colors={LIVE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.infoCard}>
              <View style={[styles.blob, styles.blobOne]} />
              <View style={styles.radarWrap}>
                <Animated.View style={[styles.radarRing, ring(0)]} />
                <Animated.View style={[styles.radarRing, ring(0.5)]} />
                <View style={styles.radarCore}>
                  <Text style={styles.radarCount}>{count}</Text>
                </View>
              </View>
              <View style={styles.flex}>
                <Text style={styles.headline}>{count > 0 ? t('incoming.headline', { count }) : t('incoming.emptyHeadline')}</Text>
                <Text style={styles.caption}>{count > 0 ? t('incoming.caption') : t('incoming.emptyCaption')}</Text>
                {count > 0 ? (
                  <View style={styles.statRow}>
                    {offers.length > 0 ? (
                      <View style={styles.statChip}>
                        <FontAwesome6 name="bolt" size={10} color="#FFFFFF" solid />
                        <Text style={styles.statText}>{t('incoming.jobsCount', { count: offers.length })}</Text>
                      </View>
                    ) : null}
                    {orders.length > 0 ? (
                      <View style={styles.statChip}>
                        <FontAwesome6 name="basket-shopping" size={10} color="#FFFFFF" solid />
                        <Text style={styles.statText}>{t('incoming.ordersCount', { count: orders.length })}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </LinearGradient>

            {/* The pile: answer the front card, swipe for the next — new ones join live. */}
            {count > 0 ? (
              <NewForYou isWorker isShop bare onOpened={handOff} onSwiping={(on) => setScrollLocked(on)} />
            ) : (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}14` }]}>
                  <FontAwesome6 name="satellite-dish" size={26} color={colors.primary} solid />
                </View>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('incoming.emptyText')}</Text>
              </View>
            )}
        </View>
      </View>
    </Modal>
  );
}

const LIVE_GRADIENT = ['#062F86', '#0055D3', '#2B83FF'] as const;

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 16 },
  headerTitle: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 18 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, padding: 14, marginBottom: 18, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  blobOne: { width: 180, height: 180, top: -80, right: -60 },
  heroTop: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePill: {
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
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  liveText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 12, letterSpacing: 1, includeFontPadding: false },
  radarWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  radarRing: { position: 'absolute', width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: 'rgba(255,255,255,0.75)' },
  radarCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  radarCount: { color: '#0055D3', fontFamily: fonts.semiBold, fontSize: 24, lineHeight: 30, includeFontPadding: false },
  headline: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 18, lineHeight: 24 },
  caption: { color: 'rgba(255,255,255,0.86)', fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  statText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 12 },
  body: { flexGrow: 1, padding: 16 },
  empty: { alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...typography.body, fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
});
