import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { LoadingIndicator } from './LoadingIndicator';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useAcceptBookingOffer, useBookingOffers, useDeclineBookingOffer } from '@/hooks/useBookingOffers';
import { usePendingOfferStore } from '@/state/pendingOfferStore';
import { showToast } from '@/state/toastStore';
import { ApiError } from '@/services/apiClient';

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * The Rapido/Uber-driver-style "incoming job" takeover screen — genuinely full-screen and
 * opaque (not a small centered card over a dim backdrop), per explicit follow-up feedback
 * that the earlier version still read as "the same size" as a plain notification. Mounted
 * ONCE at the app root (`App.tsx`), not inside `BookingsScreen` — the only thing that
 * controls its visibility is `pendingOfferStore.focusedBookingRequestId`, set from two
 * places in `usePushNotifications.ts`: `addNotificationReceivedListener` (fires the
 * instant a push arrives while the app is alive, no tap needed — this is what makes it
 * pop up over *whatever* screen the worker happens to be on, matching how a ride-request
 * app interrupts you) and the notification-response handler (tapping the notification
 * body). The system notification itself (composed by `backgroundNotificationTask.ts`)
 * remains the fallback for when the app is genuinely fully closed — this screen is the
 * "big card" experience for every other case, which in practice is most of them.
 */
export function IncomingJobModal() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { data: offers } = useBookingOffers();
  const acceptMutation = useAcceptBookingOffer();
  const declineMutation = useDeclineBookingOffer();

  const focusedBookingRequestId = usePendingOfferStore((state) => state.focusedBookingRequestId);
  const clearFocusedOffer = usePendingOfferStore((state) => state.clearFocusedOffer);
  const visible = focusedBookingRequestId !== null;
  const offer = offers?.find((item) => item.bookingRequestId === focusedBookingRequestId) ?? null;

  const [offersEverLoaded, setOffersEverLoaded] = useState(false);
  useEffect(() => {
    if (offers) setOffersEverLoaded(true);
  }, [offers]);

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
      onSuccess: () => {
        showToast({ variant: 'success', title: t('bookings.acceptedToastTitle'), message: t('bookings.acceptedToastMessage') });
        Notifications.dismissNotificationAsync(offer.bookingRequestId).catch(() => {});
        clearFocusedOffer();
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

  const busy = acceptMutation.isPending || declineMutation.isPending;
  const notFound = offersEverLoaded && !offer;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleDecline} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerBand}>
          <FontAwesome6 name="bolt" size={16} color="#FFFFFF" solid />
          <Text style={styles.headerText}>{t('bookings.newJobTitle')}</Text>
        </LinearGradient>

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
            style={[styles.declineButton, { borderColor: colors.border }]}
            onPress={handleDecline}
            disabled={busy}
            accessibilityLabel={t('bookings.decline')}
          >
            {declineMutation.isPending ? (
              <LoadingIndicator color={colors.textMuted} size={20} dotSize={4} />
            ) : (
              <FontAwesome6 name="xmark" size={22} color={colors.textMuted} solid />
            )}
          </Pressable>
          <Pressable style={styles.acceptButtonWrap} onPress={handleAccept} disabled={busy || !offer || notFound}>
            <LinearGradient
              colors={headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.acceptButton, (busy || !offer || notFound) && styles.acceptButtonDisabled]}
            >
              {acceptMutation.isPending ? (
                <LoadingIndicator size={22} dotSize={4.5} />
              ) : (
                <Text style={styles.acceptButtonText}>{t('bookings.accept')}</Text>
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
  headerBand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  headerText: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  centerWrap: { alignItems: 'center', gap: 8 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  offerGoneTitle: { ...typography.subheading, fontFamily: fonts.semiBold, textAlign: 'center' },
  offerGoneMessage: { ...typography.body, textAlign: 'center', lineHeight: 20 },
  // Deliberately huge — this is the single most load-bearing number on the whole screen,
  // matching the visual weight a fare figure carries on a ride-hailing driver app's own
  // incoming-request card.
  distanceHeadline: { fontSize: 44, fontFamily: fonts.semiBold, textAlign: 'center', marginBottom: 24 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  tagText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15 },
  actionRow: { flexDirection: 'row', gap: 14, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1 },
  declineButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonWrap: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  acceptButton: { height: 60, alignItems: 'center', justifyContent: 'center' },
  acceptButtonDisabled: { opacity: 0.6 },
  acceptButtonText: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', fontSize: 18 },
});
