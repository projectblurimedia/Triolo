import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { LoadingIndicator } from './LoadingIndicator';
import { GlassBackdrop, GlassCard } from './Glass';
import { useAcceptBookingOffer, useBookingOffers, useDeclineBookingOffer } from '@/hooks/useBookingOffers';
import { useShopOrderAction, useShopOrders } from '@/hooks/useShopOrders';
import { useMyShops } from '@/hooks/useBusinessMutations';
import { jobQueryKey } from '@/hooks/useJobs';
import { jobsService } from '@/services/jobsService';
import { PendingOffer } from '@/services/bookingOffersService';
import { formatRupees, NEW_ORDER_STATUSES, ShopOrder, shopOrdersService } from '@/services/shopOrdersService';
import { ApiError } from '@/services/apiClient';
import { openJob } from '@/state/jobFocusStore';
import { openShopOrder } from '@/state/shopOrderFocusStore';
import { useIncomingStore } from '@/state/incomingStore';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { formatDistance } from '@/utils/formatDistance';
import { placeName } from '@/utils/formatAddress';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';

type DeckItem = { key: string; createdAt: string } & ({ type: 'job'; offer: PendingOffer } | { type: 'order'; order: ShopOrder });

// Until a card has measured itself.
const CARD_HEIGHT = 154;
// Space on each side of the front card where the cards before / after it show their edge.
// How far each card in the stack shows past the one above it: those already seen on the left,
// those still to come on the right.
const STACK_STEP = 10;
const SWIPE_AWAY = 55;
const FRESH_MS = 2 * 60 * 1000;

/**
 * Live Requests: every request waiting for an answer — job requests and new shop orders together —
 * as a pile of cards in a fixed order. Cards already seen peek on the left, the next ones on the
 * right; swipe to move through them (each card keeps its own content and glides into place).
 * On Home a tap opens the Live Requests screen on that card; there (`bare`) the front card's
 * details sit under the pile. New requests join live.
 */
export function NewForYou({
  isWorker,
  isShop,
  bare,
  onOpened,
  onSwiping,
}: {
  isWorker: boolean;
  isShop: boolean;
  /** Inside the Live Requests screen: smaller heading, details of the front card below. */
  bare?: boolean;
  /** A job / order was accepted (its own screen is opening on top). */
  onOpened?: () => void;
  /** A sideways swipe started / ended: the page stops scrolling (and refreshing) meanwhile. */
  onSwiping?: (swiping: boolean) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const offers = useBookingOffers();
  const orders = useShopOrders(isShop);
  const manyShops = (useMyShops(isShop).data ?? []).length > 1;
  const focusKey = useIncomingStore((state) => state.focusKey);
  const autoAcceptKey = useIncomingStore((state) => state.autoAcceptKey);
  const [currentKey, setCurrentKey] = useState<string | null>(bare ? focusKey : null);
  const [width, setWidth] = useState(320);
  const [edgeNote, setEdgeNote] = useState(false);
  // Each card's own content height, so the pile fits the card in front with no gap.
  const [heights, setHeights] = useState<Record<string, number>>({});
  const measure = (key: string, height: number) => setHeights((prev) => (Math.abs((prev[key] ?? 0) - height) < 1 ? prev : { ...prev, [key]: height }));
  // Which card is in front, as a number that moves smoothly between cards (0 = the first).
  const progress = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const animating = useRef(false);

  const all: DeckItem[] = useMemo(
    () =>
      [
        ...(isWorker ? (offers.data ?? []) : []).map<DeckItem>((offer) => ({
          key: `job-${offer.bookingRequestId}`,
          createdAt: offer.createdAt,
          type: 'job',
          offer,
        })),
        ...(isShop ? (orders.data ?? []) : [])
          .filter((order) => NEW_ORDER_STATUSES.includes(order.status))
          .map<DeckItem>((order) => ({ key: `order-${order.id}`, createdAt: order.createdAt, type: 'order', order })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [isWorker, isShop, offers.data, orders.data],
  );

  // A card tapped on Home: Live Requests opens on it.
  useEffect(() => {
    if (bare && focusKey) setCurrentKey(focusKey);
  }, [bare, focusKey]);

  // The card being looked at stays in front when the list changes (a new one arrives, one goes).
  const found = all.findIndex((item) => item.key === currentKey);
  const index = found >= 0 ? found : 0;
  const allRef = useRef(all);
  allRef.current = all;
  const latest = useRef({ index, count: all.length, width });
  latest.current = { index, count: all.length, width };

  useEffect(() => {
    if (!animating.current) progress.setValue(index);
  }, [index, progress]);

  // The counter gives a little pop each time the card in front changes.
  useEffect(() => {
    pop.setValue(1.25);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [index, pop]);

  const goTo = (target: number) => {
    const { count, index: at } = latest.current;
    const to = Math.max(0, Math.min(count - 1, target));
    // Past either end: bounce back and say so.
    if (to !== target && count > 0) {
      setEdgeNote(true);
      setTimeout(() => setEdgeNote(false), 1400);
    }
    animating.current = true;
    Animated.timing(progress, { toValue: to, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      animating.current = false;
      // The old card is off screen by now: it can drop back into the stack without a flash.
      if (to !== at) setCurrentKey(allRef.current[to]?.key ?? null);
    });
  };
  const goToRef = useRef(goTo);
  goToRef.current = goTo;
  const swipingRef = useRef(onSwiping);
  swipingRef.current = onSwiping;

  const responder = useRef(
    PanResponder.create({
      // A touch on a card that nothing inside wants (the Live Requests card body isn't tappable):
      // the pile takes it, so the swipe that follows is ours. Buttons inside still get their taps.
      onStartShouldSetPanResponder: () => !animating.current,
      // Any drag on the pile is ours, claimed before the page's own scroll (or pull-to-refresh) can
      // take it — a finger never moves perfectly sideways — and never handed back mid-swipe.
      onMoveShouldSetPanResponderCapture: (_, g) => !animating.current && (Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5),
      onMoveShouldSetPanResponder: (_, g) => !animating.current && (Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => swipingRef.current?.(true),
      onPanResponderMove: (_, g) => {
        const { index: at, count, width: w } = latest.current;
        // Drag left: towards the next card; right: back. A little give past either end.
        const raw = at - g.dx / (w * 0.85);
        progress.setValue(Math.max(-0.3, Math.min(count - 0.7, raw)));
      },
      onPanResponderRelease: (_, g) => {
        swipingRef.current?.(false);
        const { index: at } = latest.current;
        if (g.dx < -SWIPE_AWAY || g.vx < -0.5) goToRef.current(at + 1);
        else if (g.dx > SWIPE_AWAY || g.vx > 0.5) goToRef.current(at - 1);
        else goToRef.current(at);
      },
      onPanResponderTerminate: () => {
        swipingRef.current?.(false);
        goToRef.current(latest.current.index);
      },
    }),
  ).current;

  if (all.length === 0) return null;
  const front = all[index];

  const visible = all.map((item, position) => ({ item, position })).filter(({ position }) => Math.abs(position - index) <= 2);
  // The pile takes the front card's height (an order's note adds a line); the cards behind only show their edge.
  const pileHeight = heights[front.key] ?? (bare ? 146 + richRows(front) * 40 : CARD_HEIGHT);
  const cardWidth = width - STACK_STEP * 4;
  const style = (position: number, isFront: boolean) => {
    const offset = Animated.subtract(position, progress);
    if (isFront) {
      return {
        opacity: offset.interpolate({ inputRange: [-1, -0.8, 0, 0.8, 1], outputRange: [0, 1, 1, 1, 0], extrapolate: 'clamp' }),
        transform: [
          { translateX: offset.interpolate({ inputRange: [-1, 0, 1], outputRange: [-cardWidth * 1.1, 0, cardWidth * 1.1], extrapolate: 'clamp' }) },
          { rotate: offset.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-7deg', '0deg', '7deg'], extrapolate: 'clamp' }) },
        ],
      };
    }
    return {
      opacity: offset.interpolate({ inputRange: [-3, -2, 2, 3], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
      transform: [
        {
          translateX: offset.interpolate({
            inputRange: [-2, -1, 0, 1, 2],
            outputRange: [-STACK_STEP * 2, -STACK_STEP, 0, STACK_STEP, STACK_STEP * 2],
            extrapolate: 'clamp',
          }),
        },
        { scaleY: offset.interpolate({ inputRange: [-2, -1, 0, 1, 2], outputRange: [0.88, 0.94, 1, 0.94, 0.88], extrapolate: 'clamp' }) },
      ],
    };
  };
  const veil = (position: number) =>
    Animated.subtract(position, progress).interpolate({
      inputRange: [-2, -1, 0, 1, 2],
      outputRange: [0.55, 0.3, 0, 0.3, 0.55],
      extrapolate: 'clamp',
    });
  // Drawn far-to-near, the one in front last (on top).
  const ordered = [...visible].sort((a, b) => Math.abs(b.position - index) - Math.abs(a.position - index));

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <View style={[styles.liveDot, { backgroundColor: brandColors.success }]} />
        <Text style={[bare ? styles.titleSmall : styles.title, { color: colors.text }]}>{t(bare ? 'newForYou.swipeTitle' : 'newForYou.title')}</Text>
        <Animated.View style={[styles.counter, { backgroundColor: `${colors.primary}14`, transform: [{ scale: pop }] }]}>
          <Text style={[styles.counterText, { color: colors.primary }]}>{t('newForYou.counter', { at: index + 1, count: all.length })}</Text>
        </Animated.View>
      </View>

      <View
        style={{ height: pileHeight + 4 }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        // The page holds still from the first touch on the pile, before any drag has begun.
        onTouchStart={() => onSwiping?.(true)}
        onTouchEnd={() => onSwiping?.(false)}
        onTouchCancel={() => onSwiping?.(false)}
        {...responder.panHandlers}
      >
        {ordered.map(({ item, position }) => {
          const isFront = position === index;
          return (
            <Animated.View
              key={item.key}
              pointerEvents={isFront ? 'auto' : 'none'}
              style={[
                styles.card,
                { height: pileHeight, zIndex: 10 - Math.abs(position - index) },
                isFront ? styles.frontCard : styles.stackCard,
                { backgroundColor: colors.surface, borderColor: isFront ? `${colors.primary}33` : colors.border },
                style(position, isFront),
              ]}
            >
              <RequestCard
                item={item}
                manyShops={manyShops}
                preview={!isFront}
                rich={bare}
                // On Home a tap opens Live Requests on this card.
                onPress={bare ? undefined : () => useIncomingStore.getState().openList(true, item.key)}
                onOpened={onOpened}
                autoAccept={bare && isFront && autoAcceptKey === item.key}
                onMeasure={(height) => measure(item.key, height)}
              />
              <Animated.View pointerEvents="none" style={[styles.veil, { backgroundColor: colors.background, opacity: veil(position) }]} />
            </Animated.View>
          );
        })}
      </View>
      <View style={styles.footer}>
        {edgeNote ? (
          <Text style={[styles.edgeNote, { color: colors.textMuted }]}>{t(index === 0 ? 'newForYou.firstOne' : 'newForYou.lastOne')}</Text>
        ) : all.length > 1 ? (
          <View style={styles.dots}>
            {all.slice(0, 10).map((item, position) => (
              <View
                key={item.key}
                style={[styles.dot, { backgroundColor: position === index ? colors.primary : `${colors.primary}33`, width: position === index ? 18 : 6 }]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Accept / decline for one request, shared by the card and the details panel. */
function useRequestActions(item: DeckItem | null, onOpened?: () => void) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const acceptJob = useAcceptBookingOffer();
  const declineJob = useDeclineBookingOffer();
  const acceptOrder = useShopOrderAction(({ id }: { id: string }) => shopOrdersService.accept(id), 'accept');
  const declineOrder = useShopOrderAction(({ id }: { id: string }) => shopOrdersService.decline(id));
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const onError = (err: Error) => {
    const taken = err instanceof ApiError && ['BOOKING_ALREADY_TAKEN', 'ORDER_INVALID_STATE', 'ORDER_ALREADY_TAKEN'].includes(err.code ?? '');
    showToast({
      variant: taken ? 'info' : 'error',
      title: t(taken ? 'bookings.takenToastTitle' : 'common.errorTitle'),
      message: taken ? t('bookings.takenToastMessage') : getLocalizedErrorMessage(err, t),
    });
  };

  const accept = () => {
    if (!item) return;
    setBusy('accept');
    if (item.type === 'job') {
      const id = item.offer.bookingRequestId;
      acceptJob.mutate(id, {
        onSuccess: async () => {
          Notifications.dismissNotificationAsync(id).catch(() => {});
          await queryClient.prefetchQuery({ queryKey: jobQueryKey(id), queryFn: () => jobsService.get(id) }).catch(() => {});
          showToast({ variant: 'success', title: t('bookings.acceptedToastTitle'), message: t('bookings.acceptedToastMessage') });
          openJob(id);
          onOpened?.();
        },
        onError,
        onSettled: () => setBusy(null),
      });
      return;
    }
    const id = item.order.id;
    acceptOrder.mutate(
      { id },
      {
        onSuccess: () => {
          showToast({ variant: 'success', title: t('shopOrders.acceptedTitle') });
          // Straight on to packing it.
          openShopOrder(id);
          onOpened?.();
        },
        onError,
        onSettled: () => setBusy(null),
      },
    );
  };

  const decline = () => {
    if (!item) return;
    setBusy('decline');
    if (item.type === 'job') {
      declineJob.mutate(item.offer.bookingRequestId, {
        onSuccess: () => {
          Notifications.dismissNotificationAsync(item.offer.bookingRequestId).catch(() => {});
          showToast({ variant: 'info', title: t('bookings.declinedToastTitle') });
        },
        onError,
        onSettled: () => setBusy(null),
      });
    } else {
      declineOrder.mutate(
        { id: item.order.id },
        { onSuccess: () => showToast({ variant: 'info', title: t('shopOrders.declinedToast') }), onError, onSettled: () => setBusy(null) },
      );
    }
  };

  return { busy, accept, decline };
}

function describe(item: DeckItem, manyShops: boolean, t: (key: string, options?: Record<string, unknown>) => string) {
  const isJob = item.type === 'job';
  return {
    isJob,
    name: isJob ? item.offer.customerFullName : item.order.customerFullName,
    what: isJob
      ? item.offer.skillCategories.map((key) => t(`workerProfile.skills.${key}`)).join(', ')
      : `${t('continueSteps.itemCount', { count: item.order.items.length })} · ${t(item.order.fulfillment === 'delivery' ? 'shopOrders.delivery' : 'shopOrders.pickup')}`,
    distance: formatDistance(isJob ? item.offer.distanceMeters : item.order.distanceMeters),
    place: placeName((isJob ? item.offer.locationAddress : item.order.locationAddress) ?? ''),
    kind: isJob
      ? t(item.offer.direct ? 'newForYou.bookedYou' : 'newForYou.jobRequest')
      : `${t(item.order.quick ? 'newForYou.quickOrder' : 'newForYou.newOrder')}${manyShops && item.order.shopName ? ` · ${item.order.shopName}` : ''}`,
  };
}

/** Rows in a Live Requests card's details box: place (when known), work / pickup-delivery, note. */
function richRows(item: DeckItem) {
  const place = placeName((item.type === 'job' ? item.offer.locationAddress : item.order.locationAddress) ?? '');
  return (place ? 1 : 0) + 1 + (item.type === 'order' && item.order.note ? 1 : 0);
}

/**
 * One request as a clean white card: who and how far on top, then the details and Decline /
 * Accept. On Home it's compact (a tap opens Live Requests on it); in Live Requests (`rich`) the
 * details sit in a soft box, and an order's list opens from the eye on its pickup / delivery line.
 */
function RequestCard({
  item,
  manyShops,
  preview,
  rich,
  onPress,
  onOpened,
  autoAccept,
  onMeasure,
}: {
  item: DeckItem;
  manyShops: boolean;
  /** In the stack behind the front card: shown, not usable. */
  preview?: boolean;
  rich?: boolean;
  onPress?: () => void;
  onOpened?: () => void;
  /** Accept was tapped on the floating card: accept as soon as it shows. */
  autoAccept?: boolean;
  /** The card's content height. */
  onMeasure?: (height: number) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { busy, accept, decline } = useRequestActions(item, onOpened);
  const [listOpen, setListOpen] = useState(false);
  const fresh = Date.now() - new Date(item.createdAt).getTime() < FRESH_MS;
  const info = describe(item, manyShops, t);
  useEffect(() => {
    if (!autoAccept) return;
    useIncomingStore.getState().setAutoAccept(null);
    accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAccept]);

  const row = (icon: React.ComponentProps<typeof FontAwesome6>['name'], text: string, last: boolean, right?: React.ReactNode) => (
    <View style={[styles.detailRow, last ? null : { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: `${colors.primary}22` }]}>
      <View style={[styles.detailIcon, { backgroundColor: `${colors.primary}14` }]}>
        <FontAwesome6 name={icon} size={11} color={colors.primary} solid />
      </View>
      <Text style={[styles.detailText, { color: colors.text }]} numberOfLines={1}>
        {text}
      </Text>
      {right}
    </View>
  );

  const orderLine =
    item.type === 'order'
      ? [
          t(item.order.fulfillment === 'delivery' ? 'shopOrders.fulfillmentDelivery' : 'shopOrders.fulfillmentPickup'),
          t('continueSteps.itemCount', { count: item.order.items.length }),
          item.order.fulfillment === 'delivery' && item.order.deliveryCharge > 0
            ? t('newForYou.deliveryCharge', { amount: formatRupees(item.order.deliveryCharge) })
            : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : '';
  const hasNote = item.type === 'order' && !!item.order.note;

  return (
    <Pressable
      disabled={preview || !onPress}
      onPress={onPress}
      onLayout={(event) => onMeasure?.(event.nativeEvent.layout.height)}
      style={[styles.cardInner, rich ? styles.cardInnerRich : null]}
    >
      {/* What the request is about, large and faded on the right (like Find Orders Now). */}
      <FontAwesome6
        name={info.isJob ? 'screwdriver-wrench' : 'basket-shopping'}
        size={rich ? 110 : 86}
        color={`${colors.primary}10`}
        solid
        style={rich ? styles.watermarkRich : styles.watermark}
      />
      <View style={styles.cardTop}>
        <View style={[styles.kindIcon, rich ? styles.kindIconRich : null, { backgroundColor: `${colors.primary}14` }]}>
          <FontAwesome6 name={info.isJob ? 'bolt' : 'basket-shopping'} size={rich ? 15 : 13} color={colors.primary} solid />
        </View>
        <View style={styles.flex}>
          <View style={styles.kindRow}>
            <Text style={[styles.kind, { color: colors.primary }]} numberOfLines={1}>
              {info.kind}
            </Text>
            {fresh ? (
              <View style={[styles.newPill, { backgroundColor: brandColors.success }]}>
                <Text style={styles.newPillText}>{t('newForYou.new')}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.name, rich ? styles.nameRich : null, { color: colors.text }]} numberOfLines={1}>
            {info.name}
          </Text>
        </View>
        <View style={[styles.metaPill, { backgroundColor: `${colors.primary}12` }]}>
          <FontAwesome6 name="location-arrow" size={10} color={colors.primary} solid />
          <Text style={[styles.metaText, { color: colors.primary }]}>{info.distance}</Text>
        </View>
      </View>

      {rich ? (
        <View style={[styles.details, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}1A` }]}>
          {info.place ? row('location-dot', info.place, false) : null}
          {item.type === 'job'
            ? row('screwdriver-wrench', info.what, true)
            : row(
                item.order.fulfillment === 'delivery' ? 'truck' : 'store',
                orderLine,
                !hasNote,
                <Pressable
                  disabled={preview}
                  onPress={() => setListOpen(true)}
                  hitSlop={8}
                  accessibilityLabel={t('newForYou.viewListLabel')}
                  style={[styles.eye, { backgroundColor: colors.primary }]}
                >
                  <FontAwesome6 name="eye" size={13} color="#FFFFFF" solid />
                </Pressable>,
              )}
          {item.type === 'order' && item.order.note ? row('quote-left', item.order.note, true) : null}
        </View>
      ) : (
        <Text style={[styles.what, { color: colors.textMuted }]} numberOfLines={1}>
          {[item.type === 'order' ? orderLine : info.what, info.place].filter(Boolean).join(' · ')}
        </Text>
      )}

      <View style={styles.actionsRow}>
        <Pressable
          disabled={preview || busy !== null}
          onPress={decline}
          style={[styles.decline, rich ? styles.buttonTall : null, { borderColor: `${brandColors.error}59`, backgroundColor: `${brandColors.error}0D` }]}
        >
          {busy === 'decline' ? (
            <LoadingIndicator color={brandColors.error} size={20} dotSize={4} />
          ) : (
            <Text style={[styles.declineText, { color: brandColors.error }]}>{t('bookings.decline')}</Text>
          )}
        </Pressable>
        <Pressable disabled={preview || busy !== null} onPress={accept} style={styles.flex}>
          <View style={[styles.accept, rich ? styles.buttonTall : null, { backgroundColor: brandColors.success }]}>
            {busy === 'accept' ? (
              <LoadingIndicator color="#FFFFFF" size={20} dotSize={4} />
            ) : (
              <>
                <FontAwesome6 name="check" size={13} color="#FFFFFF" solid />
                <Text style={styles.acceptText}>{t('bookings.accept')}</Text>
              </>
            )}
          </View>
        </Pressable>
      </View>
      {item.type === 'order' ? <ItemsSheet visible={listOpen} order={item.order} onClose={() => setListOpen(false)} /> : null}
    </Pressable>
  );
}

/** An order's whole list, opened from "View list". */
function ItemsSheet({ visible, order, onClose }: { visible: boolean; order: ShopOrder; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GlassBackdrop onPress={onClose} style={styles.sheetOverlay}>
        <GlassCard style={styles.sheet}>
          <View style={styles.sheetHead}>
            <View style={[styles.sheetIcon, { backgroundColor: `${colors.primary}18` }]}>
              <FontAwesome6 name="list-check" size={14} color={colors.primary} solid />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>
                {order.customerFullName}
              </Text>
              <Text style={[styles.sheetSub, { color: colors.textMuted }]}>{t('continueSteps.itemCount', { count: order.items.length })}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={[styles.sheetClose, { borderColor: colors.border }]}>
              <FontAwesome6 name="xmark" size={14} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {order.items.map((entry, position) => (
              <View key={entry.id} style={[styles.sheetRow, { borderColor: colors.border }]}>
                <View style={[styles.sheetNumber, { backgroundColor: `${colors.primary}14` }]}>
                  <Text style={[styles.sheetNumberText, { color: colors.primary }]}>{position + 1}</Text>
                </View>
                <Text style={[styles.sheetItem, { color: colors.text }]}>{entry.name}</Text>
                {entry.quantity ? (
                  <Text style={[styles.sheetQty, { color: colors.textMuted }]}>
                    {entry.quantity}
                    {entry.unit ? ` ${entry.unit}` : ''}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
          {order.note ? <Text style={[styles.sheetNote, { color: colors.textMuted }]}>“{order.note}”</Text> : null}
          <Pressable onPress={onClose} style={[styles.sheetButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.sheetButtonText}>{t('common.close')}</Text>
          </Pressable>
        </GlassCard>
      </GlassBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  title: { ...typography.subheading, fontFamily: fonts.semiBold, fontSize: 16, flex: 1 },
  titleSmall: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, flex: 1 },
  counter: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  counterText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5 },
  // Room on both sides for the edges of the cards in the stack.
  card: { position: 'absolute', left: STACK_STEP * 2, right: STACK_STEP * 2, top: 0, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  frontCard: {
    shadowColor: '#0B3A8A',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  stackCard: { elevation: 1 },
  // Cards in the stack fade into the page, a little more the further back they are.
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  cardInner: { padding: 14, gap: 8, overflow: 'hidden' },
  cardInnerRich: { padding: 16, gap: 12 },
  watermark: { position: 'absolute', right: -14, top: 34 },
  watermarkRich: { position: 'absolute', right: -18, top: 40 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kindIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  kindIconRich: { width: 44, height: 44, borderRadius: 22 },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kind: { fontFamily: fonts.semiBold, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', flexShrink: 1 },
  newPill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  newPillText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 10 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  metaText: { fontFamily: fonts.semiBold, fontSize: 11.5 },
  name: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 23 },
  nameRich: { fontSize: 19, lineHeight: 25 },
  what: { ...typography.body, fontSize: 13.5 },
  details: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 40 },
  detailIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  detailText: { ...typography.body, fontSize: 14, flex: 1 },
  eye: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  decline: { height: 44, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  declineText: { fontFamily: fonts.semiBold, fontSize: 14 },
  accept: { height: 44, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonTall: { height: 48 },
  acceptText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 15 },
  // Fixed height, so the dots / "last one" note never change the page's height mid-swipe.
  footer: { height: 24, marginTop: 10, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  dot: { height: 6, borderRadius: 3 },
  edgeNote: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, textAlign: 'center' },
  sheetOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  sheet: { borderRadius: 22, padding: 16, maxHeight: '75%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sheetIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16 },
  sheetSub: { ...typography.caption, fontSize: 12.5 },
  sheetClose: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sheetList: { flexGrow: 0 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sheetNumberText: { fontFamily: fonts.semiBold, fontSize: 12 },
  sheetItem: { ...typography.body, fontSize: 14.5, flex: 1 },
  sheetQty: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
  sheetNote: { ...typography.caption, fontSize: 12.5, fontStyle: 'italic', marginTop: 10 },
  sheetButton: { height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  sheetButtonText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 15 },
});
