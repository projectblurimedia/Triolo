import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import { ScreenContainer } from '@/components/ScreenContainer';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { fonts, typography, useThemeColors } from '@/theme';
import { useAcceptBookingOffer, useBookingOffers, useDeclineBookingOffer } from '@/hooks/useBookingOffers';
import { PendingOffer } from '@/services/bookingOffersService';
import { showToast } from '@/state/toastStore';
import { ApiError } from '@/services/apiClient';
import { formatDistance } from '@/utils/formatDistance';

/**
 * The receiving side of Quick Book's broadcast (see backend's modules/bookings and
 * `.cloud/architecture.md`'s Notification Architecture section) — every job request this
 * worker's skills fully cover, still open for anyone to accept. Backed by `useBookingOffers`
 * (polled, same 8s order of magnitude as `useNotifications`); the real-time feel mostly
 * comes from the push itself — a big, actionable notification (dedicated `booking-offers`
 * Android channel with its own Accept/Reject buttons) plus, whenever the app is alive, the
 * full-screen `IncomingJobModal` (mounted once at the app root, `App.tsx` — not here, so it
 * can pop up over whatever screen the worker is on, not just this tab) — rather than this
 * poll, which mainly exists to keep this list correct if the app is already open when an
 * offer arrives or gets taken by someone else.
 */
export function BookingsScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data: offers, isLoading } = useBookingOffers();
  const acceptMutation = useAcceptBookingOffer();
  const declineMutation = useDeclineBookingOffer();

  const handleAccept = (offer: PendingOffer) => {
    acceptMutation.mutate(offer.bookingRequestId, {
      onSuccess: () => {
        showToast({ variant: 'success', title: t('bookings.acceptedToastTitle'), message: t('bookings.acceptedToastMessage') });
        Notifications.dismissNotificationAsync(offer.bookingRequestId).catch(() => {});
      },
      onError: (err) => {
        const alreadyTaken = err instanceof ApiError && err.code === 'BOOKING_ALREADY_TAKEN';
        showToast({
          variant: alreadyTaken ? 'info' : 'error',
          title: t(alreadyTaken ? 'bookings.takenToastTitle' : 'common.errorTitle'),
          message: t(alreadyTaken ? 'bookings.takenToastMessage' : 'errors.generic'),
        });
        // A generic error leaves the offer genuinely still open (worth retrying), but
        // "already taken" is final — clear the matching system notification either way
        // so it doesn't keep showing dead Accept/Reject buttons for a job that's gone.
        if (alreadyTaken) Notifications.dismissNotificationAsync(offer.bookingRequestId).catch(() => {});
      },
    });
  };

  const handleDecline = (offer: PendingOffer) => {
    declineMutation.mutate(offer.bookingRequestId, {
      onSuccess: () => {
        showToast({ variant: 'info', title: t('bookings.declinedToastTitle') });
        Notifications.dismissNotificationAsync(offer.bookingRequestId).catch(() => {});
      },
      onError: () => showToast({ variant: 'error', title: t('common.errorTitle'), message: t('errors.generic') }),
    });
  };

  if (isLoading) {
    return (
      <ScreenContainer edges={['left', 'right']}>
        <View style={styles.centerWrap}>
          <LoadingIndicator color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  const body =
    !offers || offers.length === 0 ? (
      <View style={styles.centerWrap}>
        <FontAwesome6 name="calendar-check" size={22} color={colors.textMuted} solid />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('bookings.emptyTitle')}</Text>
        <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{t('bookings.emptyMessage')}</Text>
      </View>
    ) : (
      <FlatList
        data={offers}
        keyExtractor={(item) => item.offerId}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const accepting = acceptMutation.isPending && acceptMutation.variables === item.bookingRequestId;
          const declining = declineMutation.isPending && declineMutation.variables === item.bookingRequestId;
          const busy = accepting || declining;
          return (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.distancePill, { backgroundColor: `${colors.primary}16` }]}>
                  <FontAwesome6 name="location-dot" size={12} color={colors.primary} solid />
                  <Text style={[styles.distanceText, { color: colors.primary }]}>
                    {t('bookings.distanceAway', { distance: formatDistance(item.distanceMeters) })}
                  </Text>
                </View>
              </View>
              <View style={styles.tagRow}>
                {item.skillCategories.map((key) => (
                  <View key={key} style={[styles.tag, { backgroundColor: `${colors.primary}14` }]}>
                    <Text style={[styles.tagText, { color: colors.primary }]}>{t(`workerProfile.skills.${key}`)}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.actionRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.declineButton,
                    { borderColor: colors.border, opacity: pressed || declining ? 0.8 : 1 },
                  ]}
                  disabled={busy}
                  onPress={() => handleDecline(item)}
                >
                  {declining ? (
                    <LoadingIndicator color={colors.textMuted} size={18} dotSize={4} />
                  ) : (
                    <Text style={[styles.declineButtonText, { color: colors.textMuted }]}>{t('bookings.decline')}</Text>
                  )}
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.acceptButton,
                    { backgroundColor: colors.primary, opacity: pressed || accepting ? 0.8 : 1 },
                  ]}
                  disabled={busy}
                  onPress={() => handleAccept(item)}
                >
                  {accepting ? (
                    <LoadingIndicator color="#FFFFFF" size={18} dotSize={4} />
                  ) : (
                    <>
                      <FontAwesome6 name="check" size={13} color="#FFFFFF" solid />
                      <Text style={styles.acceptButtonText}>{t('bookings.accept')}</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    );

  return <ScreenContainer edges={['left', 'right']}>{body}</ScreenContainer>;
}

const styles = StyleSheet.create({
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 20 },
  emptyTitle: { ...typography.subheading, fontFamily: fonts.semiBold, textAlign: 'center' },
  emptyMessage: { ...typography.body, textAlign: 'center', lineHeight: 20 },
  listContent: { paddingBottom: 32 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row' },
  distancePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  distanceText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  tagText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 11 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  declineButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  declineButtonText: { ...typography.body, fontFamily: fonts.medium },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  acceptButtonText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
});
