import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useAcceptBookingOffer, useBookingOffers } from '@/hooks/useBookingOffers';
import { PendingOffer } from '@/services/bookingOffersService';
import { showToast } from '@/state/toastStore';
import { ApiError } from '@/services/apiClient';

/** "420m away" under 1km, "1.3km away" otherwise — matches user-app's own nearby-search phrasing. */
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * The receiving side of Quick Book's broadcast (see backend's modules/bookings and
 * `.cloud/architecture.md`'s Notification Architecture section) — every job request this
 * worker's skills fully cover, still open for anyone to accept. Backed by `useBookingOffers`
 * (polled, same 8s order of magnitude as `useNotifications`); the real-time feel mostly
 * comes from the push itself (a big, high-priority notification via a dedicated
 * `booking-offers` Android channel, see `usePushNotifications.ts`) rather than this poll —
 * the poll is what keeps the list correct if the app is already open when an offer arrives
 * or gets taken by someone else.
 */
export function BookingsScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data: offers, isLoading } = useBookingOffers();
  const acceptMutation = useAcceptBookingOffer();

  const handleAccept = (offer: PendingOffer) => {
    acceptMutation.mutate(offer.bookingRequestId, {
      onSuccess: () => {
        showToast({ variant: 'success', title: t('bookings.acceptedToastTitle'), message: t('bookings.acceptedToastMessage') });
      },
      onError: (err) => {
        const alreadyTaken = err instanceof ApiError && err.code === 'BOOKING_ALREADY_TAKEN';
        showToast({
          variant: alreadyTaken ? 'info' : 'error',
          title: t(alreadyTaken ? 'bookings.takenToastTitle' : 'common.errorTitle'),
          message: t(alreadyTaken ? 'bookings.takenToastMessage' : 'errors.generic'),
        });
      },
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

  if (!offers || offers.length === 0) {
    return (
      <ScreenContainer edges={['left', 'right']}>
        <View style={styles.centerWrap}>
          <FontAwesome6 name="calendar-check" size={22} color={colors.textMuted} solid />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('bookings.emptyTitle')}</Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{t('bookings.emptyMessage')}</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['left', 'right']}>
      <FlatList
        data={offers}
        keyExtractor={(item) => item.offerId}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const accepting = acceptMutation.isPending && acceptMutation.variables === item.bookingRequestId;
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
              <Pressable
                style={({ pressed }) => [
                  styles.acceptButton,
                  { backgroundColor: colors.primary, opacity: pressed || accepting ? 0.8 : 1 },
                ]}
                disabled={acceptMutation.isPending}
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
          );
        }}
      />
    </ScreenContainer>
  );
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
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
  },
  acceptButtonText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
});
