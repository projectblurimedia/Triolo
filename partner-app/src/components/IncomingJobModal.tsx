import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { LoadingIndicator } from './LoadingIndicator';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useAcceptBookingOffer, useBookingOffers, useDeclineBookingOffer } from '@/hooks/useBookingOffers';
import { usePendingOfferStore } from '@/state/pendingOfferStore';
import { openJob } from '@/state/jobFocusStore';
import { showToast } from '@/state/toastStore';
import { ApiError } from '@/services/apiClient';
import { formatDistance } from '@/utils/formatDistance';
import { jobQueryKey } from '@/hooks/useJobs';
import { jobsService } from '@/services/jobsService';

// Lets the job screen finish fading in on top before this one closes underneath it.
const MODAL_HANDOFF_MS = 350;

const ACCEPT_GRADIENT = ['#16A34A', '#22C55E'] as const;

// Only the header (including the status-bar area above it) is glass — the same even,
// cool-white frost + single hairline as user-app's glass tab bar. The rest of the screen
// stays the plain, bold original design.
const HEADER_GLASS_LIGHT = {
  fill: 'rgba(236, 244, 255, 0.85)',
  hairline: 'rgba(255, 255, 255, 0.9)',
  underline: 'rgba(15, 35, 80, 0.06)',
};
const HEADER_GLASS_DARK = {
  fill: 'rgba(18, 22, 30, 0.85)',
  hairline: 'rgba(255, 255, 255, 0.10)',
  underline: 'rgba(0, 0, 0, 0.3)',
};

/**
 * The Rapido/Uber-driver-style "incoming job" takeover screen — genuinely full-screen and
 * opaque, not a small card over a dim backdrop. Header (and status bar area) in frosted glass
 * matching user-app's tab bar; two labelled buttons, Decline and Accept.
 *
 * Mounted ONCE at the app root (`App.tsx`), not inside `BookingsScreen` — the only thing that
 * controls its visibility is `pendingOfferStore.focusedBookingRequestId`, set from two
 * places in `usePushNotifications.ts`: `addNotificationReceivedListener` (fires the
 * instant a push arrives while the app is alive, no tap needed — this is what makes it
 * pop up over *whatever* screen the worker happens to be on) and the notification-response
 * handler (tapping the notification body). The system notification itself (composed by
 * `backgroundNotificationTask.ts`) remains the fallback for when the app is fully closed.
 */
export function IncomingJobModal() {
  const { t } = useTranslation();
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { data: offers, refetch: refetchOffers } = useBookingOffers();
  const acceptMutation = useAcceptBookingOffer();
  const queryClient = useQueryClient();
  const [handingOff, setHandingOff] = useState(false);
  const declineMutation = useDeclineBookingOffer();

  const focusedBookingRequestId = usePendingOfferStore((state) => state.focusedBookingRequestId);
  const clearFocusedOffer = usePendingOfferStore((state) => state.clearFocusedOffer);
  const visible = focusedBookingRequestId !== null;
  const liveOffer = offers?.find((item) => item.bookingRequestId === focusedBookingRequestId) ?? null;
  // Accepting takes the offer out of the list (it's no longer an open offer, it's this
  // worker's job) while the job screen is still loading — keep showing the offer the worker
  // accepted instead of flashing "no longer available" for that moment.
  const lastOfferRef = useRef(liveOffer);
  if (liveOffer) lastOfferRef.current = liveOffer;
  const accepting = acceptMutation.isPending || acceptMutation.isSuccess || handingOff;
  const offer =
    liveOffer ?? (accepting && lastOfferRef.current?.bookingRequestId === focusedBookingRequestId ? lastOfferRef.current : null);

  // The push opens this screen instantly, but the offer list is only polled every 8s — so a
  // brand-new offer usually isn't in the cached list yet and the worker sat on a spinner for
  // up to 8 seconds. Fetch right away whenever a new offer is focused. "Offer gone" is only
  // decided once *that* fetch settles, never from the stale pre-push list (which would flash
  // "no longer available" for a perfectly valid new offer).
  const [checkedForId, setCheckedForId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusedBookingRequestId) {
      setCheckedForId(null);
      return;
    }
    let cancelled = false;
    refetchOffers().finally(() => {
      if (!cancelled) setCheckedForId(focusedBookingRequestId);
    });
    return () => {
      cancelled = true;
    };
  }, [focusedBookingRequestId, refetchOffers]);

  useEffect(() => {
    if (!visible) {
      acceptMutation.reset();
      declineMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on visibility changes
  }, [visible]);

  const handleAccept = () => {
    if (!offer) return;
    acceptMutation.mutate(offer.bookingRequestId, {
      onSuccess: async () => {
        const id = offer.bookingRequestId;
        Notifications.dismissNotificationAsync(id).catch(() => {});
        // The job screen is the first thing the worker sees: load the job while Accept is
        // still spinning (so it opens with the map and customer, not a spinner), open it on
        // top, and only then close this screen underneath — opening and closing two native
        // modals in the same instant could leave the wrong one showing on Android.
        setHandingOff(true);
        await queryClient.prefetchQuery({ queryKey: jobQueryKey(id), queryFn: () => jobsService.get(id) }).catch(() => {});
        openJob(id);
        showToast({ variant: 'success', title: t('bookings.acceptedToastTitle'), message: t('bookings.acceptedToastMessage') });
        setTimeout(() => {
          clearFocusedOffer();
          setHandingOff(false);
        }, MODAL_HANDOFF_MS);
      },
      onError: (err) => {
        const alreadyTaken = err instanceof ApiError && err.code === 'BOOKING_ALREADY_TAKEN';
        showToast({
          variant: alreadyTaken ? 'info' : 'error',
          title: t(alreadyTaken ? 'bookings.takenToastTitle' : 'common.errorTitle'),
          message: t(alreadyTaken ? 'bookings.takenToastMessage' : 'errors.generic'),
        });
        if (alreadyTaken) {
          Notifications.dismissNotificationAsync(offer.bookingRequestId).catch(() => {});
          clearFocusedOffer();
        }
      },
    });
  };

  const handleDecline = () => {
    if (!offer) {
      clearFocusedOffer();
      return;
    }
    const bookingRequestId = offer.bookingRequestId;
    declineMutation.mutate(bookingRequestId, {
      onSuccess: () => showToast({ variant: 'info', title: t('bookings.declinedToastTitle') }),
      onError: () => showToast({ variant: 'error', title: t('common.errorTitle'), message: t('errors.generic') }),
      onSettled: () => {
        Notifications.dismissNotificationAsync(bookingRequestId).catch(() => {});
        clearFocusedOffer();
      },
    });
  };

  const notFound = !offer && !accepting && checkedForId === focusedBookingRequestId && focusedBookingRequestId !== null;

  // The worker already tapped Accept on the notification: accept as soon as the offer is
  // loaded (once per offer), showing Accept as spinning the whole time.
  const autoAccept = usePendingOfferStore((state) => state.autoAccept);
  const autoAcceptedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoAccept || !offer || autoAcceptedIdRef.current === offer.bookingRequestId) return;
    autoAcceptedIdRef.current = offer.bookingRequestId;
    handleAccept();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per auto-accepted offer
  }, [autoAccept, offer]);
  const autoAccepting = autoAccept && !notFound && !acceptMutation.isError;

  const busy = accepting || declineMutation.isPending || autoAccepting;
  const acceptDisabled = busy || !offer || notFound;
  const glass = isDark ? HEADER_GLASS_DARK : HEADER_GLASS_LIGHT;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => !busy && handleDecline()} statusBarTranslucent>
      {/* The app's global status bar is light-on-blue; this header is light glass, so the
          status bar icons switch to dark while this screen is up (popped again on close). */}
      {visible ? <StatusBar style={isDark ? 'light' : 'dark'} /> : null}
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 14,
              backgroundColor: glass.fill,
              borderBottomColor: glass.underline,
            },
          ]}
        >
          <View style={[styles.headerHairline, { backgroundColor: glass.hairline }]} />
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerIcon}>
            <FontAwesome6 name="bolt" size={16} color="#FFFFFF" solid />
          </LinearGradient>
          <Text style={[styles.headerText, { color: colors.text }]}>{t('bookings.newJobTitle')}</Text>
        </View>

        <View style={styles.body}>
          {notFound ? (
            <View style={styles.centerWrap}>
              <View style={[styles.iconCircle, { backgroundColor: `${colors.textMuted}1A` }]}>
                <FontAwesome6 name="circle-info" size={30} color={colors.textMuted} solid />
              </View>
              <Text style={[styles.offerGoneTitle, { color: colors.text }]}>{t('bookings.offerGoneTitle')}</Text>
              <Text style={[styles.offerGoneMessage, { color: colors.textMuted }]}>{t('bookings.offerGoneMessage')}</Text>
            </View>
          ) : !offer ? (
            <View style={styles.centerWrap}>
              <LoadingIndicator color={colors.primary} />
            </View>
          ) : (
            <>
              <View style={[styles.customerAvatar, { backgroundColor: `${colors.primary}1A` }]}>
                <Text style={[styles.customerInitials, { color: colors.primary }]}>
                  {offer.customerFullName
                    ?.split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join('')}
                </Text>
              </View>
              <Text style={[styles.customerName, { color: colors.text }]} numberOfLines={2}>
                {offer.customerFullName}
              </Text>
              {offer.locationAddress ? (
                <Text style={[styles.customerArea, { color: colors.textMuted }]} numberOfLines={2}>
                  {offer.locationAddress}
                </Text>
              ) : null}
              <Text style={[styles.distanceHeadline, { color: colors.text }]}>
                {t('bookings.distanceAway', { distance: formatDistance(offer.distanceMeters) })}
              </Text>
              <View style={styles.tagRow}>
                {offer.skillCategories.map((key) => (
                  <View
                    key={key}
                    style={[styles.tag, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}33` }]}
                  >
                    <FontAwesome6 name="screwdriver-wrench" size={14} color={colors.primary} solid />
                    <Text style={[styles.tagText, { color: colors.primary }]}>{t(`workerProfile.skills.${key}`)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={[styles.actionRow, { paddingBottom: insets.bottom + 20, borderTopColor: colors.border }]}>
          <Pressable
            style={({ pressed }) => [
              styles.declineButton,
              {
                borderColor: `${brandColors.error}59`,
                backgroundColor: `${brandColors.error}0D`,
                // Greyed out while Accept is working, so it plainly can't be tapped.
                opacity: accepting || autoAccepting ? 0.35 : pressed ? 0.75 : 1,
              },
            ]}
            onPress={handleDecline}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('bookings.decline')}
          >
            {declineMutation.isPending ? (
              <LoadingIndicator color={brandColors.error} size={20} dotSize={4} />
            ) : (
              <>
                <FontAwesome6 name="xmark" size={16} color={brandColors.error} solid />
                <Text style={[styles.declineText, { color: brandColors.error }]}>{t('bookings.decline')}</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.acceptButtonWrap, { opacity: acceptDisabled ? 0.6 : pressed ? 0.85 : 1 }]}
            onPress={handleAccept}
            disabled={acceptDisabled}
            accessibilityRole="button"
            accessibilityLabel={t('bookings.accept')}
          >
            <LinearGradient colors={ACCEPT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.acceptButton}>
              {accepting || autoAccepting ? (
                <LoadingIndicator size={22} dotSize={4.5} />
              ) : (
                <>
                  <FontAwesome6 name="check" size={17} color="#FFFFFF" solid />
                  <Text style={styles.acceptButtonText}>{t('bookings.accept')}</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  // A bright hairline along the glass's bottom edge, just above the soft underline.
  headerHairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1 },
  headerIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerText: { ...typography.subheading, fontFamily: fonts.semiBold },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  centerWrap: { alignItems: 'center', gap: 8 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  offerGoneTitle: { ...typography.subheading, fontFamily: fonts.semiBold, textAlign: 'center' },
  offerGoneMessage: { ...typography.body, textAlign: 'center', lineHeight: 20 },
  // Deliberately huge — the single most load-bearing number on the whole screen, matching
  // the visual weight a fare figure carries on a ride-hailing driver app's request card.
  distanceHeadline: { fontSize: 40, fontFamily: fonts.semiBold, textAlign: 'center', marginBottom: 24 },
  customerAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  customerInitials: { fontFamily: fonts.semiBold, fontSize: 24 },
  customerName: { fontFamily: fonts.semiBold, fontSize: 22, textAlign: 'center' },
  customerArea: { ...typography.body, textAlign: 'center', marginTop: 4, marginBottom: 6, paddingHorizontal: 12 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tagText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15 },
  actionRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1 },
  declineButton: {
    flex: 1,
    height: 58,
    borderRadius: 18,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  declineText: { ...typography.subheading, fontFamily: fonts.semiBold, fontSize: 16 },
  acceptButtonWrap: { flex: 1.4, borderRadius: 18, overflow: 'hidden' },
  acceptButton: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  acceptButtonText: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', fontSize: 17 },
});
