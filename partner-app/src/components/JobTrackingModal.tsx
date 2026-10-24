import React, { useEffect, useRef, useState } from 'react';
import { placeName } from '@/utils/formatAddress';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CancelButton } from './CancelButton';
import { Button } from './Button';
import { ConfirmModal } from './ConfirmModal';
import { useAdGate, useBusyAction } from './Ads';
import { LiveMap, MapPoint } from './LiveMap';
import { LoadingIndicator } from './LoadingIndicator';
import { ToastHost } from './ToastHost';
import { ProblemDetailModal } from './ProblemDetailModal';
import { useAssignedProblems } from '@/hooks/useProblems';
import { useJob, useJobAction } from '@/hooks/useJobs';
import { useJobFocusStore } from '@/state/jobFocusStore';
import { JobStatus, jobsService, WORKER_CANCELLABLE_STATUSES, WorkerJob } from '@/services/jobsService';
import { ApiError } from '@/services/apiClient';
import { isTrackingTrip, startTripTracking, stopTripTracking } from '@/services/tripTracking';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { callPhone, distanceBetween, openDirections } from '@/utils/tripLinks';
import { formatDistance } from '@/utils/formatDistance';
import { askForLocation, ensureLocationOn } from '@/utils/ensureLocationOn';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

const STATUS_ICONS: Record<JobStatus, IconName> = {
  broadcasting: 'tower-broadcast',
  accepted: 'user-check',
  on_the_way: 'motorcycle',
  arrived: 'location-dot',
  in_progress: 'screwdriver-wrench',
  work_done: 'clipboard-check',
  completed: 'circle-check',
  cancelled: 'ban',
};
const MAP_STATUSES: JobStatus[] = ['accepted', 'on_the_way', 'arrived'];
const DONE_GRADIENT = ['#16A34A', '#22C55E'] as const;
const STAR_COLOR = '#FBBF24';
const MAP_HEIGHT = Math.round(Dimensions.get('window').height * 0.38);

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

/**
 * The worker's live Quick Book job screen (Rapido-style), mounted once at the app root and
 * opened via jobFocusStore. Per status:
 *  - accepted: map (customer's location + you), Get Directions (opens the Google Maps app —
 *    free, no Maps API), Call, Start Trip → starts sharing live location (keeps going while
 *    minimised, with a "Trip in progress" notification — see services/tripTracking.ts)
 *  - on the way: Get Directions, I've Arrived (stops sharing)
 *  - arrived: enter the customer's 4-digit PIN to start the work (5 tries)
 *  - in progress: Mark Work Done → the customer then confirms and rates
 *  - finished: the customer's rating and feedback; cancelled: a notice
 * If the screen is reopened mid-trip (e.g. after the app restarted), location sharing resumes.
 */
export function JobTrackingModal() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const jobId = useJobFocusStore((state) => state.jobId);
  const close = useJobFocusStore((state) => state.close);
  const { data: job, isLoading, isError, refetch } = useJob(jobId);
  // For a job that came from a problem post: that post's photos and description.
  const assignedProblems = useAssignedProblems(!!job?.problemPostId);
  const linkedProblem = assignedProblems.data?.find((problem) => problem.id === job?.problemPostId);
  const [showProblem, setShowProblem] = useState(false);
  const [myPosition, setMyPosition] = useState<MapPoint | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const pinInputRef = useRef<TextInput>(null);
  const [confirmDone, setConfirmDone] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // This modal draws edge-to-edge, so Android doesn't resize it for the keyboard on its own:
  // while the PIN keyboard is up, the map hides and the screen shrinks to the space above
  // the keyboard, so the PIN boxes and Verify button stay in view.
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const visible = jobId !== null;
  // Mark Work Done: location, then a local business's ad while the button spins, then confirm.
  const { adLoading, waitForAd } = useAdGate(visible, 'work_done');
  const { busy: markingDone, run } = useBusyAction();
  const markDone = () =>
    run(async () => {
      if (adLoading || !(await askForLocation())) return;
      if (await waitForAd()) setConfirmDone(true);
    });
  const status = job?.status;
  const tripText = { title: t('job.trackingTitle'), body: t('job.trackingBody') };

  const startTrip = useJobAction(({ id }: { id: string }) => jobsService.startTrip(id));
  const arrive = useJobAction(({ id }: { id: string }) => jobsService.arrive(id));
  const verifyPin = useJobAction(({ id, value }: { id: string; value: string }) => jobsService.verifyPin(id, value));
  const workDone = useJobAction(({ id }: { id: string }) => jobsService.workDone(id));
  const cancelJob = useJobAction(({ id }: { id: string }) => jobsService.cancel(id));

  useEffect(() => {
    if (!visible) {
      setPin('');
      setPinError(null);
      setMyPosition(null);
    }
  }, [visible]);

  // Your own position on the map while heading to the job (foreground only, while open).
  useEffect(() => {
    if (!visible || !status || !MAP_STATUSES.includes(status)) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted || cancelled) return;
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        (position) => setMyPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      );
      if (cancelled) subscription.remove();
    })().catch(() => {});
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [visible, status]);

  // Keep live-location sharing in step with the job: resume it if the trip is on the way but
  // sharing stopped (app restarted), and make sure it's off once the trip is over.
  useEffect(() => {
    if (!visible || !job) return;
    if (job.status === 'on_the_way') {
      isTrackingTrip(job.id).then((tracking) => {
        if (!tracking) startTripTracking(job.id, tripText).catch(() => {});
      });
    } else if (job.status !== 'accepted') {
      isTrackingTrip(job.id).then((tracking) => {
        if (tracking) stopTripTracking();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, job?.id, job?.status]);

  const onError = (error: unknown) => {
    // The customer acted first (cancelled, finished…) and this screen hadn't polled yet —
    // not a failure: just pull the real status and say so.
    if (error instanceof ApiError && (error.code === 'BOOKING_INVALID_STATE' || error.code === 'BOOKING_TRIP_NOT_ACTIVE')) {
      refetch();
      showToast({ variant: 'info', title: t('job.statusChangedTitle'), message: t('job.statusChangedMessage') });
      return;
    }
    showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
  };

  const handleStartTrip = async (j: WorkerJob) => {
    // The customer tracks the worker from here on, so location must actually be on first.
    if (!(await ensureLocationOn())) {
      showToast({ variant: 'error', title: t('job.locationRequiredTitle'), message: t('job.locationRequiredMessage') });
      return;
    }
    startTrip.mutate(
      { id: j.id },
      {
        onSuccess: async () => {
          const sharing = await startTripTracking(j.id, tripText).catch(() => false);
          showToast(
            sharing
              ? { variant: 'success', title: t('job.tripStartedTitle'), message: t('job.tripStartedMessage') }
              : { variant: 'info', title: t('job.locationOffTitle'), message: t('job.locationOffMessage') },
          );
          openDirections({ latitude: j.latitude, longitude: j.longitude });
        },
        onError,
      },
    );
  };

  const handleArrive = (j: WorkerJob) => {
    arrive.mutate(
      { id: j.id },
      {
        onSuccess: () => {
          stopTripTracking();
          showToast({ variant: 'success', title: t('job.arrivedTitle'), message: t('job.arrivedMessage') });
        },
        onError,
      },
    );
  };

  const handleVerifyPin = (j: WorkerJob) => {
    setPinError(null);
    verifyPin.mutate(
      { id: j.id, value: pin },
      {
        onSuccess: () => {
          setPin('');
          showToast({ variant: 'success', title: t('job.pinVerifiedTitle'), message: t('job.pinVerifiedMessage') });
        },
        onError: (error) => {
          setPin('');
          if (error instanceof ApiError && error.code === 'BOOKING_PIN_INVALID') {
            const left = (error.details as { attemptsLeft?: number } | undefined)?.attemptsLeft ?? 0;
            setPinError(t('job.pinWrong', { count: left }));
          } else {
            setPinError(getLocalizedErrorMessage(error, t));
          }
        },
      },
    );
  };

  const handleWorkDone = (j: WorkerJob) => {
    workDone.mutate(
      { id: j.id },
      {
        onSuccess: () => showToast({ variant: 'success', title: t('job.workDoneTitle'), message: t('job.workDoneMessage') }),
        onError,
        onSettled: () => setConfirmDone(false),
      },
    );
  };

  const handleCancel = (j: WorkerJob) => {
    cancelJob.mutate(
      { id: j.id },
      {
        onSuccess: () => {
          stopTripTracking();
          showToast({ variant: 'info', title: t('job.cancelledToastTitle'), message: t('job.cancelledToastMessage') });
        },
        onError,
        onSettled: () => setConfirmCancel(false),
      },
    );
  };

  const jobPoint = job ? { latitude: job.latitude, longitude: job.longitude } : null;
  const workerPoint =
    myPosition ??
    (job?.workerLatitude != null && job.workerLongitude != null
      ? { latitude: job.workerLatitude, longitude: job.workerLongitude }
      : null);
  const distance = workerPoint && jobPoint ? distanceBetween(workerPoint, jobPoint) : (job?.distanceMeters ?? null);

  const renderBanner = (j: WorkerJob) => {
    const tone =
      j.status === 'cancelled'
        ? brandColors.error
        : j.status === 'completed' || j.status === 'work_done'
          ? brandColors.success
          : colors.primary;
    return (
      <View style={[styles.banner, { backgroundColor: `${tone}12`, borderColor: `${tone}33` }]}>
        <View style={[styles.bannerIcon, { backgroundColor: tone }]}>
          <FontAwesome6 name={STATUS_ICONS[j.status]} size={16} color="#FFFFFF" solid />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.bannerTitle, { color: colors.text }]}>{t(`job.status.${j.status}.title`)}</Text>
          <Text style={[styles.bannerMessage, { color: colors.textMuted }]}>
            {j.status === 'cancelled' && j.cancelledBy === 'admin'
              ? `${t('job.adminCancelled')}${j.cancelReason ? ` ${t('job.reason', { reason: j.cancelReason })}` : ''}`
              : j.status === 'cancelled' && j.cancelledBy === 'worker'
                ? t('job.cancelledByYou')
                : t(`job.status.${j.status}.message`, { name: j.customerFullName })}
            {MAP_STATUSES.includes(j.status) && distance != null
              ? ` · ${t('job.distanceAway', { distance: formatDistance(distance) })}`
              : ''}
          </Text>
        </View>
      </View>
    );
  };

  // A job that came from a Your Problems post: its quotation, plus the customer's photos
  // and description one tap away.
  const renderProblem = (j: WorkerJob) =>
    j.problemPostId ? (
      <View style={[styles.card, styles.problemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.flex}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('problemDetail.quotation')}</Text>
          <Text style={[styles.quotation, { color: colors.text }]}>
            {j.quotationAmount != null ? `₹${j.quotationAmount.toLocaleString('en-IN')}` : '—'}
          </Text>
        </View>
        <Pressable
          style={[styles.problemButton, { borderColor: colors.primary, opacity: linkedProblem ? 1 : 0.5 }]}
          onPress={() => setShowProblem(true)}
          disabled={!linkedProblem}
        >
          <FontAwesome6 name="images" size={14} color={colors.primary} solid />
          <Text style={[styles.secondaryText, { color: colors.primary }]}>{t('problemDetail.viewProblem')}</Text>
        </Pressable>
      </View>
    ) : null;

  const renderCustomer = (j: WorkerJob) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.customerRow}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(j.customerFullName)}</Text>
        </LinearGradient>
        <View style={styles.flex}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('job.customer')}</Text>
          <Text style={[styles.customerName, { color: colors.text }]}>{j.customerFullName}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {j.skillCategories.map((key) => t(`workerProfile.skills.${key}`)).join(', ')}
          </Text>
        </View>
        {j.status !== 'completed' && j.status !== 'cancelled' ? (
          <Pressable
            style={[styles.roundButton, { backgroundColor: brandColors.success }]}
            onPress={() => callPhone(j.customerMobileNumber)}
            accessibilityLabel={t('job.callCustomer')}
          >
            <FontAwesome6 name="phone" size={16} color="#FFFFFF" solid />
          </Pressable>
        ) : null}
      </View>
      {j.locationAddress ? (
        <View style={[styles.addressRow, { borderTopColor: colors.border }]}>
          <FontAwesome6 name="location-dot" size={13} color={colors.primary} solid />
          <Text style={[styles.addressText, { color: colors.text }]}>{placeName(j.locationAddress)}</Text>
        </View>
      ) : null}
    </View>
  );

  const renderPinEntry = (j: WorkerJob) => (
    <View style={[styles.card, styles.pinCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
      <Text style={[styles.pinTitle, { color: colors.text }]}>{t('job.pinTitle')}</Text>
      <Text style={[styles.meta, styles.center, { color: colors.textMuted }]}>{t('job.pinHint')}</Text>
      {/* Four digit boxes over one invisible input — a single big-font TextInput clipped
          the digits' tops on Android (font padding) and sat off-centre (letterSpacing). */}
      <Pressable style={styles.pinBoxes} onPress={() => pinInputRef.current?.focus()} accessibilityLabel={t('job.pinTitle')}>
        {[0, 1, 2, 3].map((index) => {
          const digit = pin[index];
          const isNext = index === pin.length;
          const borderColor = pinError ? brandColors.error : digit || isNext ? colors.primary : colors.border;
          return (
            <View
              key={index}
              style={[styles.pinBox, { borderColor, backgroundColor: digit ? `${colors.primary}0D` : colors.background }]}
            >
              <Text style={[styles.pinDigit, { color: colors.text }]}>{digit ?? ''}</Text>
            </View>
          );
        })}
        <TextInput
          ref={pinInputRef}
          style={styles.pinHiddenInput}
          value={pin}
          onChangeText={(text) => {
            setPinError(null);
            setPin(text.replace(/[^0-9]/g, '').slice(0, 4));
          }}
          keyboardType="number-pad"
          maxLength={4}
          caretHidden
        />
      </Pressable>
      {pinError ? <Text style={[styles.pinError, { color: brandColors.error }]}>{pinError}</Text> : null}
      <View style={styles.fullWidth}>
        <Button
          label={t('job.verifyPin')}
          onPress={() => handleVerifyPin(j)}
          loading={verifyPin.isPending}
          disabled={pin.length !== 4}
        />
      </View>
    </View>
  );

  const renderFeedback = (j: WorkerJob) =>
    j.status === 'completed' ? (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('job.customerFeedback')}</Text>
        {j.workerRating ? (
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <FontAwesome6
                key={star}
                name="star"
                size={18}
                color={star <= (j.workerRating ?? 0) ? STAR_COLOR : colors.border}
                solid
              />
            ))}
          </View>
        ) : (
          <Text style={[styles.meta, { color: colors.textMuted }]}>{t('job.noRating')}</Text>
        )}
        {j.workerReview ? <Text style={[styles.review, { color: colors.text }]}>“{j.workerReview}”</Text> : null}
      </View>
    ) : null;

  const renderActions = (j: WorkerJob) => {
    if (j.status === 'accepted' || j.status === 'on_the_way') {
      return (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
            onPress={() => openDirections({ latitude: j.latitude, longitude: j.longitude })}
          >
            <FontAwesome6 name="diamond-turn-right" size={15} color={colors.primary} solid />
            <Text style={[styles.secondaryText, { color: colors.primary }]}>{t('job.directions')}</Text>
          </Pressable>
          <View style={styles.flex}>
            {j.status === 'accepted' ? (
              <Button label={t('job.startTrip')} onPress={() => handleStartTrip(j)} loading={startTrip.isPending} />
            ) : (
              <Button
                label={t('job.arrived')}
                onPress={() => handleArrive(j)}
                loading={arrive.isPending}
                gradient={DONE_GRADIENT}
              />
            )}
          </View>
        </View>
      );
    }
    if (j.status === 'arrived') return renderPinEntry(j);
    if (j.status === 'in_progress') {
      // A local business's ad first (when one is running nearby), then the confirmation.
      return <Button label={t('job.markWorkDone')} onPress={markDone} loading={adLoading || markingDone} gradient={DONE_GRADIENT} />;
    }
    if (j.status === 'work_done') {
      return <Text style={[styles.waiting, { color: colors.textMuted }]}>{t('job.waitingForCustomer')}</Text>;
    }
    return null;
  };

  const renderBody = () => {
    if (isLoading || !job) {
      return (
        <View style={styles.centerBody}>
          {isError ? (
            <>
              <Text style={[styles.bannerTitle, { color: colors.text }]}>{t('job.loadFailed')}</Text>
              <View style={styles.fullWidth}>
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
      <>
        {MAP_STATUSES.includes(job.status) && keyboardHeight === 0 ? (
          <LiveMap customer={jobPoint} worker={workerPoint} height={MAP_HEIGHT} />
        ) : null}
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.panel, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {renderBanner(job)}
          {renderActions(job)}
          {renderProblem(job)}
          {renderCustomer(job)}
          {renderFeedback(job)}
          {WORKER_CANCELLABLE_STATUSES.includes(job.status) ? (
            <CancelButton label={t('job.cancelJob')} hint={t('job.cancelHint')} onPress={() => setConfirmCancel(true)} />
          ) : null}
        </ScrollView>
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <KeyboardAvoidingView
          style={[
            styles.container,
            { backgroundColor: colors.background, paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0 },
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
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
                  {status ? t(`job.status.${status}.title`) : t('job.title')}
                </Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {job
                    ? `${job.customerFullName} · ${job.skillCategories.map((key) => t(`workerProfile.skills.${key}`)).join(', ')}`
                    : ''}
                </Text>
              </View>
            </View>
          </LinearGradient>
          {renderBody()}
          <ToastHost />
        </KeyboardAvoidingView>

        <ProblemDetailModal problem={showProblem ? (linkedProblem ?? null) : null} onClose={() => setShowProblem(false)} />

        <ConfirmModal
          visible={confirmDone}
          icon="circle-check"
          gradient={DONE_GRADIENT}
          title={t('job.confirmDoneTitle')}
          message={t('job.confirmDoneMessage')}
          confirmLabel={t('job.markWorkDone')}
          loading={workDone.isPending}
          onConfirm={() => job && handleWorkDone(job)}
          onCancel={() => setConfirmDone(false)}
        />

        <ConfirmModal
          visible={confirmCancel}
          icon="ban"
          gradient={CANCEL_GRADIENT}
          title={t('job.confirmCancelTitle')}
          message={t(job?.problemPostId ? 'job.confirmCancelProblemMessage' : 'job.confirmCancelMessage', {
            name: job?.customerFullName ?? '',
          })}
          confirmLabel={t('job.cancelJob')}
          loading={cancelJob.isPending}
          onConfirm={() => job && handleCancel(job)}
          onCancel={() => setConfirmCancel(false)}
        />
      </View>
    </Modal>
  );
}

const CANCEL_GRADIENT = ['#ef4444', '#dc2626'] as const;

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  fullWidth: { alignSelf: 'stretch', marginTop: 12 },
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
  centerBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  panel: { padding: 16, gap: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  bannerIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { ...typography.body, fontFamily: fonts.semiBold },
  bannerMessage: { ...typography.caption, marginTop: 2, lineHeight: 17 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  cardLabel: { ...typography.caption, fontFamily: fonts.medium, fontSize: 11 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 17 },
  customerName: { ...typography.body, fontFamily: fonts.semiBold },
  meta: { ...typography.caption },
  roundButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  problemCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quotation: { fontFamily: fonts.semiBold, fontSize: 22, lineHeight: 30 },
  problemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  addressText: { ...typography.body, fontSize: 13, flex: 1 },
  actionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  secondaryButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  pinCard: { alignItems: 'center', borderWidth: 1.5 },
  pinTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginBottom: 4 },
  pinBoxes: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 16, marginBottom: 4 },
  pinBox: { width: 54, height: 62, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pinDigit: { fontSize: 26, lineHeight: 34, fontFamily: fonts.semiBold, textAlign: 'center', includeFontPadding: false },
  // Covers the boxes so a tap anywhere focuses it, but is fully transparent.
  pinHiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: 'transparent' },
  pinError: { ...typography.caption, fontFamily: fonts.medium, marginTop: 8, textAlign: 'center' },
  waiting: { ...typography.body, fontFamily: fonts.medium, textAlign: 'center', paddingVertical: 8 },
  starsRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  review: { ...typography.body, marginTop: 8, fontStyle: 'italic' },
});
