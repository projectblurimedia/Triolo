import React, { useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { ConfirmModal } from './ConfirmModal';
import { FinishJobModal } from './FinishJobModal';
import { LiveMap } from './LiveMap';
import { LoadingIndicator } from './LoadingIndicator';
import { RadarPulse } from './RadarPulse';
import { RatingStars, STAR_COLOR } from './RatingStars';
import { Avatar } from './WorkerMiniCard';
import { SKILL_CATEGORIES } from './WorkerProfileModal';
import { ToastHost } from './ToastHost';
import { useBooking, useCancelBooking, useCompleteBooking } from '@/hooks/useBookings';
import { openBookingTracker, useBookingTrackerStore } from '@/state/bookingTrackerStore';
import { ensureLocation } from '@/state/locationStore';
import {
  BookingRequestStatus,
  bookingsService,
  CANCELLABLE_STATUSES,
  CustomerBooking,
  TRIP_STATUSES,
} from '@/services/bookingsService';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { callPhone, distanceBetween } from '@/utils/tripLinks';
import { formatDistanceValue } from '@/utils/nearbyResult';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { BlurScope } from './Glass';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

const STATUS_ICONS: Record<BookingRequestStatus, IconName> = {
  broadcasting: 'tower-broadcast',
  accepted: 'user-check',
  on_the_way: 'motorcycle',
  arrived: 'location-dot',
  in_progress: 'screwdriver-wrench',
  work_done: 'clipboard-check',
  completed: 'circle-check',
  cancelled: 'ban',
  expired: 'hourglass-end',
};

// The progress steps, each done once its timestamp exists.
const STEPS: { key: string; at: keyof CustomerBooking }[] = [
  { key: 'accepted', at: 'acceptedAt' },
  { key: 'on_the_way', at: 'startedAt' },
  { key: 'arrived', at: 'arrivedAt' },
  { key: 'in_progress', at: 'pinVerifiedAt' },
  { key: 'work_done', at: 'workDoneAt' },
  { key: 'completed', at: 'completedAt' },
];

const CANCEL_GRADIENT = ['#ef4444', '#dc2626'] as const;
const FINISH_GRADIENT = ['#16A34A', '#22C55E'] as const;
const MAP_HEIGHT = Math.round(Dimensions.get('window').height * 0.4);
// Same broadcast radius as the Quick Book screen (testing value, also the API max).
const QUICK_BOOK_RADIUS_KM = 50;

function formatTime(iso: string): string {
  const date = new Date(iso);
  const hours = date.getHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(date.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

/**
 * The customer's live Quick Book screen (Rapido-style), mounted once at the app root and
 * opened via bookingTrackerStore. Follows the booking through every status:
 *  - searching: radar animation + Cancel
 *  - worker assigned / on the way / arrived: free OpenStreetMap map (LiveMap) with the job
 *    location and the worker's live position, the worker's details + Call, and the 4-digit
 *    PIN to tell the worker on arrival; Cancel stays available until the PIN is used
 *  - in progress / work done: Mark as Finished → 1–5 stars + optional feedback
 *  - finished / cancelled: summary, including the rating given
 * Polls fast while the worker is moving (see useBooking).
 */
export function BookingTrackingModal() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const bookingId = useBookingTrackerStore((state) => state.bookingId);
  const close = useBookingTrackerStore((state) => state.close);
  const { data: booking, isLoading, isError, refetch } = useBooking(bookingId);
  const cancelBooking = useCancelBooking();
  const completeBooking = useCompleteBooking();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [rebooking, setRebooking] = useState(false);

  const visible = bookingId !== null;
  const status = booking?.status;
  const workerName = booking?.worker?.fullName ?? t('tracking.yourWorker');
  const skillLabels = (booking?.skillCategories ?? []).map((key) => t(`workerProfile.skills.${key}`)).join(', ');

  const handleCancel = () => {
    if (!bookingId) return;
    cancelBooking.mutate(bookingId, {
      onSuccess: () => showToast({ variant: 'info', title: t('tracking.cancelledToast') }),
      onError: (error) =>
        showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) }),
      onSettled: () => setConfirmCancel(false),
    });
  };

  const handleFinish = (rating: number, review: string) => {
    if (!bookingId) return;
    completeBooking.mutate(
      { id: bookingId, rating, review },
      {
        onSuccess: () => showToast({ variant: 'success', title: t('tracking.finishedToast') }),
        onError: (error) =>
          showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) }),
        onSettled: () => setFinishing(false),
      },
    );
  };

  // 'No worker found' → ask again with the same skills, from where the customer is now
  // (location must be on, like every Quick Book).
  const handleBookAgain = async () => {
    if (!booking || rebooking) return;
    setRebooking(true);
    try {
      const here = await ensureLocation();
      if (!here) {
        showToast({ variant: 'error', title: t('location.requiredTitle'), message: t('location.requiredMessage') });
        return;
      }
      const result = await bookingsService.createQuickBooking({
        skillCategories: booking.skillCategories,
        latitude: here.latitude,
        longitude: here.longitude,
        radiusKm: QUICK_BOOK_RADIUS_KM,
        locationAddress: booking.locationAddress ?? undefined,
      });
      if (result.matchedWorkerCount === 0) {
        bookingsService.cancel(result.bookingRequestId).catch(() => {});
        showToast({ variant: 'info', title: t('quickBook.noWorkersTitle'), message: t('quickBook.noWorkersMessage') });
        return;
      }
      openBookingTracker(result.bookingRequestId);
    } catch (error) {
      showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
    } finally {
      setRebooking(false);
    }
  };

  const workerPoint =
    booking?.worker?.latitude != null && booking.worker.longitude != null
      ? { latitude: booking.worker.latitude, longitude: booking.worker.longitude }
      : null;
  const jobPoint = booking ? { latitude: booking.latitude, longitude: booking.longitude } : null;
  const distance = workerPoint && jobPoint ? distanceBetween(workerPoint, jobPoint) : null;

  const renderStatusBanner = (b: CustomerBooking) => {
    const tone =
      b.status === 'cancelled'
        ? brandColors.error
        : b.status === 'completed' || b.status === 'work_done'
          ? brandColors.success
          : colors.primary;
    return (
      <View style={[styles.banner, { backgroundColor: `${tone}12`, borderColor: `${tone}33` }]}>
        <View style={[styles.bannerIcon, { backgroundColor: tone }]}>
          <FontAwesome6 name={STATUS_ICONS[b.status]} size={16} color="#FFFFFF" solid />
        </View>
        <View style={styles.bannerText}>
          <Text style={[styles.bannerTitle, { color: colors.text }]}>{t(`tracking.status.${b.status}.title`)}</Text>
          <Text style={[styles.bannerMessage, { color: colors.textMuted }]}>
            {t(`tracking.status.${b.status}.message`, { name: workerName })}
            {b.status === 'on_the_way' && distance != null
              ? ` · ${t('tracking.distanceAway', { distance: formatDistanceValue(distance) })}`
              : ''}
          </Text>
        </View>
      </View>
    );
  };

  const renderPin = (b: CustomerBooking) =>
    b.arrivalPin ? (
      <View style={[styles.card, styles.pinCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('tracking.pinLabel')}</Text>
        <View style={styles.pinRow}>
          {b.arrivalPin.split('').map((digit, index) => (
            <View
              key={index}
              style={[styles.pinDigit, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}40` }]}
            >
              <Text style={[styles.pinDigitText, { color: colors.primary }]}>{digit}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.pinHint, { color: colors.textMuted }]}>{t('tracking.pinHint')}</Text>
      </View>
    ) : null;

  const renderWorker = (b: CustomerBooking) =>
    b.worker ? (
      <View style={[styles.card, styles.workerRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Avatar name={b.worker.fullName} size={50} />
        <View style={styles.workerInfo}>
          <Text style={[styles.workerName, { color: colors.text }]} numberOfLines={1}>
            {b.worker.fullName}
          </Text>
          <Text style={[styles.workerSkills, { color: colors.textMuted }]} numberOfLines={1}>
            {b.worker.skillCategories.map((key) => t(`workerProfile.skills.${key}`)).join(', ')}
          </Text>
          <RatingStars average={b.worker.ratingAverage} count={b.worker.ratingCount} />
        </View>
        {b.status !== 'completed' && b.status !== 'cancelled' ? (
          <Pressable
            style={[styles.callButton, { backgroundColor: brandColors.success }]}
            onPress={() => callPhone(b.worker!.mobileNumber)}
            accessibilityLabel={t('tracking.callWorker')}
          >
            <FontAwesome6 name="phone" size={16} color="#FFFFFF" solid />
          </Pressable>
        ) : null}
      </View>
    ) : null;

  const renderSteps = (b: CustomerBooking) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('tracking.progress')}</Text>
      {STEPS.map((step, index) => {
        const at = b[step.at] as string | null;
        const done = !!at;
        const last = index === STEPS.length - 1;
        return (
          <View key={step.key} style={styles.stepRow}>
            <View style={styles.stepRail}>
              <View
                style={[
                  styles.stepDot,
                  done
                    ? { backgroundColor: brandColors.success, borderColor: brandColors.success }
                    : { borderColor: colors.border },
                ]}
              >
                {done ? <FontAwesome6 name="check" size={9} color="#FFFFFF" solid /> : null}
              </View>
              {!last ? <View style={[styles.stepLine, { backgroundColor: done ? brandColors.success : colors.border }]} /> : null}
            </View>
            <View style={styles.stepText}>
              <Text style={[styles.stepTitle, { color: done ? colors.text : colors.textMuted }]}>
                {t(`tracking.step.${step.key}`)}
              </Text>
              {at ? <Text style={[styles.stepTime, { color: colors.textMuted }]}>{formatTime(at)}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderLocation = (b: CustomerBooking) => (
    <>
      {b.quotationAmount != null ? (
        <View style={[styles.card, styles.locationRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome6 name="indian-rupee-sign" size={14} color={colors.primary} solid />
          <Text style={[styles.locationText, { color: colors.text }]}>
            {t('tracking.quotation', { amount: b.quotationAmount.toLocaleString('en-IN') })}
          </Text>
        </View>
      ) : null}
      {b.locationAddress ? (
        <View style={[styles.card, styles.locationRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome6 name="location-dot" size={14} color={colors.primary} solid />
          <Text style={[styles.locationText, { color: colors.text }]}>{b.locationAddress}</Text>
        </View>
      ) : null}
    </>
  );

  const renderRating = (b: CustomerBooking) =>
    b.status === 'completed' && b.workerRating ? (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('tracking.yourRating')}</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <FontAwesome6
              key={star}
              name="star"
              size={18}
              color={star <= (b.workerRating ?? 0) ? STAR_COLOR : colors.border}
              solid
            />
          ))}
        </View>
        {b.workerReview ? <Text style={[styles.review, { color: colors.text }]}>“{b.workerReview}”</Text> : null}
      </View>
    ) : null;

  const renderBody = () => {
    if (isLoading || !booking) {
      return (
        <View style={styles.center}>
          {isError ? (
            <>
              <Text style={[styles.bannerTitle, { color: colors.text }]}>{t('tracking.loadFailed')}</Text>
              <View style={styles.retryWrap}>
                <Button label={t('common.retry')} onPress={() => refetch()} />
              </View>
            </>
          ) : (
            <LoadingIndicator size={40} dotSize={6} color={colors.primary} />
          )}
        </View>
      );
    }

    if (booking.status === 'broadcasting' || rebooking) {
      const radarIcon =
        booking.skillCategories.length === 1
          ? (SKILL_CATEGORIES.find((skill) => skill.key === booking.skillCategories[0])?.icon ?? 'screwdriver-wrench')
          : 'screwdriver-wrench';
      return (
        <View style={styles.center}>
          <RadarPulse icon={radarIcon} />
          <Text style={[styles.searchTitle, { color: colors.text }]}>{t('quickBook.searchingTitle')}</Text>
          <Text style={[styles.searchMessage, { color: colors.textMuted }]}>{t('quickBook.searchingMessage')}</Text>
          <Text style={[styles.searchSkills, { color: colors.primary }]}>{skillLabels}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.cancelLink,
              { backgroundColor: `${brandColors.error}${pressed ? '24' : '12'}`, borderColor: `${brandColors.error}59` },
            ]}
            onPress={() => setConfirmCancel(true)}
            hitSlop={8}
          >
            <FontAwesome6 name="xmark" size={13} color={brandColors.error} solid />
            <Text style={[styles.cancelLinkText, { color: brandColors.error }]}>{t('tracking.cancelBooking')}</Text>
          </Pressable>
        </View>
      );
    }

    if (booking.status === 'expired') {
      return (
        <View style={styles.center}>
          <View style={[styles.expiredIcon, { backgroundColor: `${brandColors.warning}1F` }]}>
            <FontAwesome6 name="hourglass-end" size={30} color={brandColors.warning} solid />
          </View>
          <Text style={[styles.searchTitle, { color: colors.text }]}>{t('tracking.status.expired.title')}</Text>
          <Text style={[styles.searchMessage, { color: colors.textMuted }]}>{t('tracking.status.expired.message')}</Text>
          <Text style={[styles.searchSkills, { color: colors.primary }]}>{skillLabels}</Text>
          <View style={styles.retryWrap}>
            <Button label={t('tracking.bookAgain')} onPress={handleBookAgain} loading={rebooking} />
          </View>
        </View>
      );
    }

    const onTrip = TRIP_STATUSES.includes(booking.status);
    const canCancel = CANCELLABLE_STATUSES.includes(booking.status);
    const canFinish = booking.status === 'work_done';

    return (
      <>
        {onTrip ? <LiveMap customer={jobPoint} worker={workerPoint} height={MAP_HEIGHT} /> : null}
        <ScrollView contentContainerStyle={[styles.panel, { paddingBottom: insets.bottom + 24 }]}>
          {renderStatusBanner(booking)}
          {renderPin(booking)}
          {renderWorker(booking)}
          {canFinish ? (
            <View style={styles.actionWrap}>
              <Button label={t('tracking.markFinished')} onPress={() => setFinishing(true)} gradient={FINISH_GRADIENT} />
            </View>
          ) : null}
          {renderRating(booking)}
          {renderLocation(booking)}
          {booking.status !== 'cancelled' ? renderSteps(booking) : null}
          {canCancel ? (
            <Pressable
              style={({ pressed }) => [
                styles.cancelLink,
                { backgroundColor: `${brandColors.error}${pressed ? '24' : '12'}`, borderColor: `${brandColors.error}59` },
              ]}
              onPress={() => setConfirmCancel(true)}
              hitSlop={8}
            >
              <FontAwesome6 name="xmark" size={13} color={brandColors.error} solid />
              <Text style={[styles.cancelLinkText, { color: brandColors.error }]}>{t('tracking.cancelBooking')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </>
    );
  };

  const title = status ? t(`tracking.status.${status}.title`) : t('tracking.title');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <BlurScope style={StyleSheet.absoluteFill}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <LinearGradient
            colors={headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { paddingTop: insets.top + 14 }]}
          >
            <View style={styles.headerRow}>
              <Pressable style={styles.backButton} onPress={close} accessibilityLabel={t('common.close')} hitSlop={8}>
                <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
              </Pressable>
              <View style={styles.titleGroup}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {t('tracking.subtitle', { skills: skillLabels })}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {renderBody()}
          <ToastHost />
        </View>

        <ConfirmModal
          visible={confirmCancel}
          icon="ban"
          gradient={CANCEL_GRADIENT}
          title={t('tracking.cancelConfirmTitle')}
          message={t('tracking.cancelConfirmMessage')}
          confirmLabel={t('tracking.cancelBooking')}
          loading={cancelBooking.isPending}
          onConfirm={handleCancel}
          onCancel={() => setConfirmCancel(false)}
        />
        <FinishJobModal
          visible={finishing}
          workerName={booking?.worker?.fullName ?? null}
          loading={completeBooking.isPending}
          onConfirm={handleFinish}
          onCancel={() => setFinishing(false)}
        />
      </BlurScope>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 18, paddingHorizontal: 20 },
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  retryWrap: { alignSelf: 'stretch', marginTop: 16 },
  expiredIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  searchTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginTop: 28, textAlign: 'center' },
  searchMessage: { ...typography.body, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  searchSkills: { ...typography.body, fontFamily: fonts.semiBold, marginTop: 10, textAlign: 'center' },
  panel: { padding: 16, gap: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  bannerIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  bannerText: { flex: 1 },
  bannerTitle: { ...typography.body, fontFamily: fonts.semiBold },
  bannerMessage: { ...typography.caption, marginTop: 2, lineHeight: 17 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  cardLabel: { ...typography.caption, fontFamily: fonts.medium, marginBottom: 10 },
  pinCard: { alignItems: 'center', borderWidth: 1.5 },
  pinRow: { flexDirection: 'row', gap: 10 },
  pinDigit: { width: 50, height: 58, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pinDigitText: { fontSize: 28, fontFamily: fonts.semiBold },
  pinHint: { ...typography.caption, textAlign: 'center', marginTop: 10 },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  workerInfo: { flex: 1, gap: 2 },
  workerName: { ...typography.body, fontFamily: fonts.semiBold },
  workerSkills: { ...typography.caption },
  callButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  actionWrap: { marginTop: 2 },
  starsRow: { flexDirection: 'row', gap: 4 },
  review: { ...typography.body, marginTop: 8, fontStyle: 'italic' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationText: { ...typography.body, flex: 1, fontSize: 13 },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 20 },
  stepDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, flex: 1, minHeight: 14 },
  stepText: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 14 },
  stepTitle: { ...typography.body, fontSize: 13, fontFamily: fonts.medium },
  stepTime: { ...typography.caption, fontSize: 11 },
  // A soft red pill, so cancelling is easy to find without competing with the main action.
  cancelLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    borderWidth: 1.5,
    marginTop: 14,
  },
  cancelLinkText: { ...typography.body, fontFamily: fonts.semiBold },
});
