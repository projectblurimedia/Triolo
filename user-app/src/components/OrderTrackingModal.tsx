import React, { useEffect, useState } from 'react';
import { placeName } from '@/utils/formatAddress';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CancelButton } from './CancelButton';
import { Button } from './Button';
import { ConfirmModal } from './ConfirmModal';
import { LoadingIndicator } from './LoadingIndicator';
import { RatingStars, STAR_COLOR } from './RatingStars';
import { ToastHost } from './ToastHost';
import { Avatar } from './WorkerMiniCard';
import { useCancelOrder, useCancelStalledOrder, useOrder, useRateOrder } from '@/hooks/useOrders';
import { useOrderTrackerStore } from '@/state/orderTrackerStore';
import { CUSTOMER_CANCELLABLE, CustomerOrder, formatRupees, isFindingShop, OrderItem, OrderStatus } from '@/services/ordersService';
import { orderShopName } from '@/utils/orderShopName';
import { RadarPulse } from './RadarPulse';
import { LATE_AFTER_MS, LateNotice, useNow } from './LateNotice';
import { FinishJobModal } from './FinishJobModal';

// The shop took the order but hasn't handed it over (mirrors the backend's ORDER_LATE_STATUSES).
const LATE_ORDER_STATUSES: OrderStatus[] = ['accepted', 'preparing', 'packed', 'ready_for_pickup', 'out_for_delivery'];
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { callPhone, openDirections } from '@/utils/tripLinks';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { BlurScope } from './Glass';
import { PullToRefresh } from './PullToRefresh';
import { WaitCountdown } from './WaitCountdown';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

const STATUS_ICONS: Record<OrderStatus, IconName> = {
  placed: 'paper-plane',
  accepted: 'store',
  preparing: 'basket-shopping',
  packed: 'receipt',
  ready_for_pickup: 'bag-shopping',
  out_for_delivery: 'truck-fast',
  completed: 'circle-check',
  cancelled: 'ban',
  declined: 'circle-xmark',
  expired: 'hourglass-end',
};
const ENDED_BADLY: OrderStatus[] = ['cancelled', 'declined', 'expired'];
const SUCCESS_GRADIENT = ['#16A34A', '#22C55E'] as const;

// Built by hand — Hermes on Android doesn't reliably ship Intl time formatting.
function formatClock(iso: string): string {
  const date = new Date(iso);
  const hours = date.getHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(date.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

function itemLabel(item: OrderItem): string {
  return [item.quantity, item.unit].filter(Boolean).join(' ');
}

/**
 * A shop order as the customer follows it (root-mounted, opened via `openOrderTracker`):
 * status and timeline, the shop (callable once it accepts), the pickup/delivery PIN at
 * handover, and — once packed — the bill: packed items with prices, the delivery charge and
 * total, and the items the shop could not pack listed separately. The customer can cancel
 * only before the shop accepts (spec §3). Rating is the order's last step: a completed order
 * shows the rating card inline (stars required, review optional) and stays under Active in My
 * Orders and on Home until it's rated — one rating per order, which also feeds the shop's average.
 */
export function OrderTrackingModal() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const orderId = useOrderTrackerStore((state) => state.orderId);
  const close = useOrderTrackerStore((state) => state.close);
  const { data: order, isLoading, isError, refetch } = useOrder(orderId);
  // Only a pull shows the spinner — not the automatic refresh every few seconds.
  const [pulling, setPulling] = useState(false);
  const pullRefresh = () => {
    setPulling(true);
    refetch().finally(() => setPulling(false));
  };
  const cancelOrder = useCancelOrder();
  // An order the shop hasn't moved on for over an hour: cancel and rate the shop.
  const cancelStalled = useCancelStalledOrder();
  const [ratingLate, setRatingLate] = useState(false);
  const now = useNow();
  const rateOrder = useRateOrder();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');

  useEffect(() => {
    setStars(0);
    setReview('');
  }, [orderId]);

  const isStalled = (o: CustomerOrder) =>
    LATE_ORDER_STATUSES.includes(o.status) && !!o.updatedAt && now - new Date(o.updatedAt).getTime() >= LATE_AFTER_MS;

  const handleCancelStalled = (rating: number, reviewText: string) => {
    if (!orderId) return;
    cancelStalled.mutate(
      { id: orderId, rating, review: reviewText },
      {
        onSuccess: () => showToast({ variant: 'info', title: t('late.cancelledToast') }),
        onError: (error) =>
          showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) }),
        onSettled: () => setRatingLate(false),
      },
    );
  };

  const handleCancel = () => {
    if (!orderId) return;
    cancelOrder.mutate(orderId, {
      onSuccess: () => showToast({ variant: 'info', title: t('orders.cancelledToast') }),
      onError: (error) =>
        showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) }),
      onSettled: () => setConfirmCancel(false),
    });
  };

  const handleRate = () => {
    if (!orderId) return;
    if (stars === 0) {
      showToast({ variant: 'info', title: t('orders.pickStarsTitle') });
      return;
    }
    rateOrder.mutate(
      { id: orderId, rating: stars, review: review.trim() },
      {
        onSuccess: () => showToast({ variant: 'success', title: t('orders.ratedToast') }),
        onError: (error) =>
          showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) }),
      },
    );
  };

  const renderBanner = (o: CustomerOrder) => {
    const tone = ENDED_BADLY.includes(o.status)
      ? brandColors.error
      : o.status === 'completed'
        ? brandColors.success
        : colors.primary;
    return (
      <View style={[styles.card, styles.banner, { backgroundColor: `${tone}12`, borderColor: `${tone}33` }]}>
        <View style={[styles.bannerIcon, { backgroundColor: tone }]}>
          <FontAwesome6 name={STATUS_ICONS[o.status]} size={16} color="#FFFFFF" solid />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.bannerTitle, { color: colors.text }]}>{t(`orders.status.${o.status}.title`)}</Text>
          <Text style={[styles.bannerMessage, { color: colors.textMuted }]}>
            {o.status === 'completed' && !o.shopRating
              ? t('orders.rateStepMessage')
              : o.status === 'cancelled' && o.cancelledBy === 'admin'
                ? t('orders.adminCancelled')
                : t(`orders.status.${o.status}.message`, { shop: o.shop.name })}
          </Text>
          {o.cancelReason ? (
            <Text style={[styles.bannerMessage, { color: colors.textMuted }]}>
              {t('orders.reason', { reason: o.cancelReason === 'late' ? t('late.orderReason') : o.cancelReason })}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  const renderPin = (o: CustomerOrder) =>
    o.pin ? (
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, styles.pinCard]}>
        <Text style={styles.pinLabel}>
          {t(o.fulfillment === 'delivery' ? 'orders.pinLabelDelivery' : 'orders.pinLabelPickup')}
        </Text>
        <View style={styles.pinDigits}>
          {o.pin.split('').map((digit, index) => (
            <View key={index} style={styles.pinDigitBox}>
              <Text style={styles.pinDigit}>{digit}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.pinHint}>{t(o.fulfillment === 'delivery' ? 'orders.pinHintDelivery' : 'orders.pinHintPickup')}</Text>
      </LinearGradient>
    ) : null;

  const renderShop = (o: CustomerOrder) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Avatar photoUrl={o.shop.photoUrl ?? undefined} name={o.shop.name} size={48} />
        <View style={styles.flex}>
          <Text style={[styles.shopName, { color: colors.text }]} numberOfLines={1}>
            {o.shop.name}
          </Text>
          <RatingStars average={o.shop.ratingAverage} count={o.shop.ratingCount} />
          {o.shop.address ? (
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
              {o.shop.address}
            </Text>
          ) : null}
        </View>
        {o.shop.mobileNumber ? (
          <Pressable
            style={[styles.roundButton, { backgroundColor: brandColors.success }]}
            onPress={() => callPhone(o.shop.mobileNumber as string)}
          >
            <FontAwesome6 name="phone" size={15} color="#FFFFFF" solid />
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.fulfillmentRow, { borderTopColor: colors.border }]}>
        <FontAwesome6 name={o.fulfillment === 'delivery' ? 'truck' : 'store'} size={13} color={colors.primary} solid />
        <Text style={[styles.fulfillmentText, { color: colors.text }]}>
          {o.fulfillment === 'delivery'
            ? t('orders.deliveryTo', { address: placeName(o.locationAddress) || t('orders.yourLocation') })
            : t('orders.pickupAtShop')}
        </Text>
        {o.fulfillment === 'pickup' && o.shop.latitude != null && o.shop.longitude != null && o.status !== 'completed' ? (
          <Pressable
            onPress={() => openDirections({ latitude: o.shop.latitude as number, longitude: o.shop.longitude as number })}
            hitSlop={8}
          >
            <Text style={[styles.link, { color: colors.primary }]}>{t('orders.directions')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const renderItemRow = (item: OrderItem, showPrice: boolean) => {
    const icon: IconName = item.status === 'packed' ? 'circle-check' : item.status === 'unavailable' ? 'circle-xmark' : 'circle';
    const tone =
      item.status === 'packed' ? brandColors.success : item.status === 'unavailable' ? brandColors.error : colors.border;
    return (
      <View key={item.id} style={styles.itemRow}>
        <FontAwesome6 name={icon} size={15} color={tone} solid={item.status !== 'pending'} />
        <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[styles.itemQty, { color: colors.textMuted }]}>{itemLabel(item)}</Text>
        {showPrice ? <Text style={[styles.itemPrice, { color: colors.text }]}>{formatRupees(item.price)}</Text> : null}
      </View>
    );
  };

  const renderItems = (o: CustomerOrder) => {
    const billed = o.totalAmount != null;
    if (!billed) {
      return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('orders.yourList', { count: o.items.length })}</Text>
          {o.items.map((item) => renderItemRow(item, false))}
          {o.fulfillment === 'delivery' && o.deliveryCharge > 0 ? (
            <Text style={[styles.meta, styles.estimate, { color: colors.textMuted }]}>
              {t('orders.deliveryChargeNote', { amount: formatRupees(o.deliveryCharge) })}
            </Text>
          ) : null}
        </View>
      );
    }
    const packed = o.items.filter((item) => item.status === 'packed');
    const missing = o.items.filter((item) => item.status === 'unavailable');
    return (
      <>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.billHeader}>
            <FontAwesome6 name="receipt" size={14} color={colors.primary} solid />
            <Text style={[styles.cardLabel, styles.noMargin, { color: colors.textMuted }]}>{t('orders.bill')}</Text>
          </View>
          {packed.map((item) => renderItemRow(item, true))}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.sumRow}>
            <Text style={[styles.sumLabel, { color: colors.textMuted }]}>{t('orders.itemsTotal')}</Text>
            <Text style={[styles.sumValue, { color: colors.text }]}>{formatRupees(o.itemsTotal)}</Text>
          </View>
          {o.fulfillment === 'delivery' ? (
            <View style={styles.sumRow}>
              <Text style={[styles.sumLabel, { color: colors.textMuted }]}>{t('orders.deliveryCharge')}</Text>
              <Text style={[styles.sumValue, { color: colors.text }]}>{formatRupees(o.deliveryCharge)}</Text>
            </View>
          ) : null}
          <View style={styles.sumRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>{t('orders.total')}</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>{formatRupees(o.totalAmount)}</Text>
          </View>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{t('orders.payAtHandover')}</Text>
        </View>
        {missing.length > 0 ? (
          <View style={[styles.card, { backgroundColor: `${brandColors.error}0D`, borderColor: `${brandColors.error}33` }]}>
            <View style={styles.billHeader}>
              <FontAwesome6 name="circle-exclamation" size={14} color={brandColors.error} solid />
              <Text style={[styles.cardLabel, styles.noMargin, { color: brandColors.error }]}>
                {t('orders.notAvailable', { count: missing.length })}
              </Text>
            </View>
            {missing.map((item) => renderItemRow(item, false))}
          </View>
        ) : null}
      </>
    );
  };

  /**
   * The order's steps, the same list from the moment it's sent: sent, accepted by the shop
   * (named when it's a particular shop), packed, ready / out for delivery, completed, rated.
   * Each shows its time; the first one not done yet is "now".
   */
  const renderSteps = (o: CustomerOrder) => {
    if (ENDED_BADLY.includes(o.status)) return null;
    const claimed = !!o.businessId;
    const steps: { key: string; label: string; at: string | null; done: boolean }[] = [
      { key: 'placed', label: t('orders.step.placed'), at: o.createdAt, done: true },
      {
        key: 'accepted',
        label: o.acceptedAt && claimed
          ? t('orders.stepAcceptedBy', { shop: o.shop.name })
          : claimed
            ? t('orders.stepAcceptName', { shop: o.shop.name })
            : t('orders.stepAcceptAny'),
        at: o.acceptedAt,
        done: !!o.acceptedAt,
      },
      { key: 'packed', label: t('orders.step.packed'), at: o.packedAt, done: !!o.packedAt },
      {
        key: 'ready',
        label: t(`orders.step.${o.fulfillment === 'delivery' ? 'out_for_delivery' : 'ready_for_pickup'}`),
        at: o.readyAt,
        done: !!o.readyAt,
      },
      { key: 'completed', label: t('orders.step.completed'), at: o.completedAt, done: !!o.completedAt },
      { key: 'rated', label: t('orders.step.rated'), at: null, done: !!o.shopRating },
    ];
    const currentIndex = steps.findIndex((step) => !step.done);
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('orders.progress')}</Text>
        {steps.map((step, index) => {
          const current = index === currentIndex;
          return (
            <View key={step.key} style={styles.stepRow}>
              <View style={styles.stepRail}>
                <View
                  style={[
                    styles.stepDot,
                    step.done
                      ? { backgroundColor: brandColors.success }
                      : current
                        ? { backgroundColor: `${colors.primary}1F`, borderWidth: 2, borderColor: colors.primary }
                        : { backgroundColor: colors.border },
                  ]}
                >
                  {step.done ? <FontAwesome6 name="check" size={9} color="#FFFFFF" solid /> : null}
                </View>
                {index < steps.length - 1 ? (
                  <View style={[styles.stepLine, { backgroundColor: steps[index + 1].done ? brandColors.success : colors.border }]} />
                ) : null}
              </View>
              <View style={styles.stepBody}>
                <Text
                  style={[
                    styles.stepText,
                    { color: step.done || current ? colors.text : colors.textMuted },
                    current ? { color: colors.primary } : null,
                  ]}
                >
                  {step.label}
                </Text>
                {step.at ? (
                  <Text style={[styles.stepTime, { color: colors.textMuted }]}>{formatClock(step.at)}</Text>
                ) : current ? (
                  <Text style={[styles.stepTime, { color: colors.primary }]}>{t('waiting.now')}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderRating = (o: CustomerOrder) => {
    if (o.status !== 'completed') return null;
    if (o.shopRating) {
      return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('orders.yourRating')}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <FontAwesome6
                key={star}
                name="star"
                size={18}
                color={star <= (o.shopRating ?? 0) ? STAR_COLOR : colors.border}
                solid
              />
            ))}
          </View>
          {o.shopReview ? <Text style={[styles.review, { color: colors.text }]}>“{o.shopReview}”</Text> : null}
        </View>
      );
    }
    return (
      <View style={[styles.card, styles.rateCard, { backgroundColor: colors.surface, borderColor: `${STAR_COLOR}66` }]}>
        <Text style={[styles.rateTitle, { color: colors.text }]}>{t('orders.rateTitle')}</Text>
        <Text style={[styles.bannerMessage, styles.centerText, { color: colors.textMuted }]}>
          {t('orders.rateLabel', { shop: o.shop.name })}
        </Text>
        <View style={styles.bigStars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => setStars(star)} hitSlop={6} accessibilityLabel={`${star}`}>
              <FontAwesome6 name="star" size={34} color={star <= stars ? STAR_COLOR : colors.border} solid />
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[styles.reviewInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          value={review}
          onChangeText={setReview}
          maxLength={500}
          multiline
          placeholder={t('orders.reviewPlaceholder')}
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.actionWrap}>
          <Button
            label={t('orders.submitRating')}
            onPress={handleRate}
            loading={rateOrder.isPending}
            gradient={SUCCESS_GRADIENT}
          />
        </View>
      </View>
    );
  };

  const renderBody = () => {
    if (isLoading || !order) {
      return (
        <View style={styles.center}>
          {isError ? (
            <>
              <Text style={[styles.bannerTitle, { color: colors.text }]}>{t('orders.loadFailed')}</Text>
              <View style={styles.actionWrap}>
                <Button label={t('common.retry')} onPress={() => refetch()} />
              </View>
            </>
          ) : (
            <LoadingIndicator size={40} dotSize={6} color={colors.primary} />
          )}
        </View>
      );
    }
    return (
      <PullToRefresh refreshing={pulling} onRefresh={pullRefresh}>
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* A Quick Order still looking for a shop: every matching shop nearby has it. */}
          {isFindingShop(order) ? (
            <View style={styles.findingHero}>
              <RadarPulse icon="store" />
              <Text style={[styles.findingTitle, { color: colors.text }]}>{t('quickOrder.findingShop')}</Text>
              <Text style={[styles.findingText, { color: colors.textMuted }]}>
                {t(order.fulfillment === 'delivery' ? 'quickOrder.findingDelivery' : 'quickOrder.findingPickup')}
              </Text>
            </View>
          ) : (
            renderBanner(order)
          )}
          {/* Waiting for an answer: how long until it ends by itself (changeable). A Quick Order
              waits like a Quick Book. */}
          {order.status === 'placed' ? (
            <View style={styles.countdownGap}>
              <WaitCountdown createdAt={order.createdAt} kind={order.quick ? 'quickOrderMinutes' : 'orderMinutes'} />
            </View>
          ) : null}
          {isStalled(order) ? (
            <LateNotice
              title={t('late.shopTitle', { shop: order.shop.name })}
              message={t('late.shopMessage')}
              actionLabel={t('late.shopAction')}
              onPress={() => setRatingLate(true)}
            />
          ) : null}
          {renderPin(order)}
          {renderRating(order)}
          {renderSteps(order)}
          {renderItems(order)}
          {order.businessId ? renderShop(order) : null}
          {CUSTOMER_CANCELLABLE.includes(order.status) ? (
            <CancelButton label={t('orders.cancel')} hint={t('orders.cancelHint')} onPress={() => setConfirmCancel(true)} />
          ) : null}
        </ScrollView>
      </PullToRefresh>
    );
  };

  return (
    <Modal visible={orderId !== null} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <BlurScope style={StyleSheet.absoluteFill}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <LinearGradient
            colors={headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { paddingTop: insets.top + 14 }]}
          >
            <Pressable style={styles.backButton} onPress={close} accessibilityLabel={t('common.close')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {order ? (isFindingShop(order) ? t('quickOrder.title') : t(`orders.status.${order.status}.title`)) : t('orders.title')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {order ? orderShopName(order, t) : ''}
              </Text>
            </View>
          </LinearGradient>
          {renderBody()}
          <ToastHost />
        </View>

        <ConfirmModal
          visible={confirmCancel}
          icon="ban"
          gradient={['#ef4444', '#dc2626']}
          title={t('orders.cancelConfirmTitle')}
          message={t('orders.cancelConfirmMessage')}
          confirmLabel={t('orders.cancel')}
          loading={cancelOrder.isPending}
          onConfirm={handleCancel}
          onCancel={() => setConfirmCancel(false)}
        />
        <FinishJobModal
          visible={ratingLate}
          workerName={order?.shop.name ?? null}
          loading={cancelStalled.isPending}
          onConfirm={handleCancelStalled}
          onCancel={() => setRatingLate(false)}
          title={t('late.rateShopTitle')}
          message={t('late.rateShopMessage', { shop: order?.shop.name ?? '' })}
          rateLabel={t('late.rateShopLabel')}
          confirmLabel={t('late.cancelAndRate')}
        />
      </BlurScope>
    </Modal>
  );
}

const styles = StyleSheet.create({
  countdownGap: { marginBottom: 14 },
  findingHero: { alignItems: 'center', paddingTop: 16, paddingBottom: 18 },
  findingTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginTop: 24, textAlign: 'center' },
  findingText: { ...typography.body, textAlign: 'center', marginTop: 6, lineHeight: 20, paddingHorizontal: 12 },
  container: { flex: 1 },
  flex: { flex: 1 },
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
  body: { padding: 18, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16 },
  bannerMessage: { ...typography.caption, lineHeight: 18, marginTop: 2 },
  pinCard: { alignItems: 'center', borderWidth: 0, gap: 10 },
  pinLabel: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.semiBold, fontSize: 13 },
  pinDigits: { flexDirection: 'row', gap: 10 },
  pinDigitBox: {
    width: 52,
    height: 60,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDigit: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 28, lineHeight: 36, includeFontPadding: false },
  pinHint: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 12, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shopName: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16, marginBottom: 2 },
  meta: { ...typography.caption, fontSize: 12, marginTop: 2 },
  roundButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fulfillmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    paddingTop: 12,
  },
  fulfillmentText: { ...typography.body, fontSize: 13, flex: 1 },
  link: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
  cardLabel: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  noMargin: { marginBottom: 0 },
  billHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  itemName: { ...typography.body, fontSize: 14, flex: 1 },
  itemQty: { ...typography.caption, fontSize: 12 },
  itemPrice: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, minWidth: 64, textAlign: 'right' },
  estimate: { marginTop: 8 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  sumLabel: { ...typography.body, fontSize: 13 },
  sumValue: { ...typography.body, fontFamily: fonts.medium, fontSize: 14 },
  totalLabel: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16 },
  totalValue: { fontFamily: fonts.semiBold, fontSize: 20, lineHeight: 28 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepRail: { alignItems: 'center', width: 20 },
  stepDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, height: 22 },
  stepText: { ...typography.body, fontSize: 14, lineHeight: 20, flex: 1 },
  stepBody: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  stepTime: { ...typography.caption, fontSize: 11, lineHeight: 20 },
  starsRow: { flexDirection: 'row', gap: 4 },
  review: { ...typography.body, fontStyle: 'italic', marginTop: 8 },
  actionWrap: { alignSelf: 'stretch' },
  rateCard: { alignItems: 'center', gap: 10 },
  rateTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 17 },
  centerText: { textAlign: 'center' },
  bigStars: { flexDirection: 'row', gap: 10, marginVertical: 4 },
  reviewInput: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 70,
    textAlignVertical: 'top',
    ...typography.body,
    fontSize: 14,
  },
});
