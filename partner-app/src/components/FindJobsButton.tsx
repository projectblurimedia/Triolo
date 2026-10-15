import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadingIndicator } from './LoadingIndicator';
import { bookingOffersService, PendingOffer } from '@/services/bookingOffersService';
import { BOOKING_OFFERS_QUERY_KEY } from '@/hooks/useBookingOffers';
import { NEARBY_PROBLEMS_QUERY_KEY } from '@/hooks/useProblems';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

const POSITION_TIMEOUT_MS = 6000;

/** Where the worker is right now, if location is already allowed — never prompts, never hangs. */
async function currentPosition(): Promise<{ latitude: number; longitude: number } | undefined> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted || !(await Location.hasServicesEnabledAsync())) return undefined;
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), POSITION_TIMEOUT_MS)),
    ]);
    const fix = position ?? (await Location.getLastKnownPositionAsync());
    return fix ? { latitude: fix.coords.latitude, longitude: fix.coords.longitude } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * "Find Jobs Now": asks the server for every Quick Book request still looking for a worker
 * near where you are (not only the ones whose push reached you), and refreshes nearby
 * problems too. Notifications can be late or missed; this always works.
 * `card` is Home's big shortcut; `bar` sits at the top of Bookings → Requests.
 */
export function FindJobsButton({
  variant,
  onFound,
}: {
  variant: 'card' | 'bar';
  /** Called with the open requests after a search that found at least one. */
  onFound?: (offers: PendingOffer[]) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const queryClient = useQueryClient();
  const search = useMutation({
    mutationFn: async () => bookingOffersService.search(await currentPosition()),
    onSuccess: (offers) => {
      queryClient.setQueryData(BOOKING_OFFERS_QUERY_KEY, offers);
      queryClient.invalidateQueries({ queryKey: NEARBY_PROBLEMS_QUERY_KEY });
      if (offers.length > 0) {
        showToast({
          variant: 'success',
          title: t('findJobs.foundTitle', { count: offers.length }),
          message: t('findJobs.foundMessage'),
        });
        onFound?.(offers);
      } else {
        showToast({ variant: 'info', title: t('findJobs.noneTitle'), message: t('findJobs.noneMessage') });
      }
    },
    onError: (error) =>
      showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) }),
  });

  if (variant === 'bar') {
    return (
      <Pressable
        onPress={() => search.mutate()}
        disabled={search.isPending}
        style={({ pressed }) => [
          styles.bar,
          { borderColor: `${colors.primary}55`, backgroundColor: `${colors.primary}${pressed ? '1F' : '10'}` },
        ]}
      >
        {search.isPending ? (
          <LoadingIndicator size={18} dotSize={4} color={colors.primary} />
        ) : (
          <FontAwesome6 name="magnifying-glass-location" size={15} color={colors.primary} solid />
        )}
        <Text style={[styles.barText, { color: colors.primary }]}>
          {t(search.isPending ? 'findJobs.searching' : 'findJobs.button')}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => search.mutate()}
      disabled={search.isPending}
      style={({ pressed }) => [styles.cardWrap, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <FontAwesome6 name="magnifying-glass-location" size={70} color="rgba(255,255,255,0.14)" solid style={styles.watermark} />
        <View style={styles.cardIcon}>
          {search.isPending ? (
            <LoadingIndicator size={22} dotSize={4} color="#FFFFFF" />
          ) : (
            <FontAwesome6 name="magnifying-glass-location" size={19} color="#FFFFFF" solid />
          )}
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{t(search.isPending ? 'findJobs.searching' : 'findJobs.button')}</Text>
          <Text style={styles.cardHint} numberOfLines={2}>
            {t('findJobs.hint')}
          </Text>
        </View>
        <FontAwesome6 name="chevron-right" size={14} color="#FFFFFF" solid />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  barText: { ...typography.body, fontFamily: fonts.semiBold },
  cardWrap: { marginBottom: 18 },
  card: { borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -8, bottom: -14 },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  cardHint: { ...typography.caption, color: 'rgba(255,255,255,0.88)', fontSize: 12, lineHeight: 16 },
});
