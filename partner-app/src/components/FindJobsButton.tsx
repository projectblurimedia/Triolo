import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { useQueryClient } from '@tanstack/react-query';
import { LoadingIndicator } from './LoadingIndicator';
import { bookingOffersService, PendingOffer } from '@/services/bookingOffersService';
import { BOOKING_OFFERS_QUERY_KEY } from '@/hooks/useBookingOffers';
import { NEARBY_PROBLEMS_QUERY_KEY } from '@/hooks/useProblems';
import { showToast } from '@/state/toastStore';
import { useLocationGatedMutation } from '@/hooks/useLocationGatedMutation';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

const POSITION_TIMEOUT_MS = 6000;
const FAB = 62;

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
 * `card` is Home's big shortcut; `fab` is the round button floating over Bookings → Requests
 * (bottom right, above the tab bar) — it never pushes the list down.
 */
export function FindJobsButton({
  variant,
  onFound,
}: {
  variant: 'card' | 'fab';
  /** Called with the open requests after a search that found at least one. */
  onFound?: (offers: PendingOffer[]) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  // The round button's soft pulse, so it reads as "tap to search".
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (variant !== 'fab') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [variant, pulse]);
  // Location is asked for before the spinner starts.
  const search = useLocationGatedMutation({
    mutationFn: async (_: void) => bookingOffersService.search(await currentPosition()),
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

  if (variant === 'fab') {
    const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
    const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
    return (
      <View pointerEvents="box-none" style={[styles.fabWrap, { bottom: 66 + Math.max(insets.bottom, 16) + 18 }]}>
        <View style={[styles.fabLabel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.fabLabelText, { color: colors.text }]} numberOfLines={1}>
            {t(search.isPending ? 'findJobs.searching' : 'findJobs.button')}
          </Text>
        </View>
        <View style={styles.fabSpot}>
          {search.isPending ? null : (
            <Animated.View
              pointerEvents="none"
              style={[styles.fabRing, { borderColor: colors.primary, opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
            />
          )}
          <Pressable
            onPress={() => search.mutate()}
            disabled={search.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('findJobs.button')}
            style={({ pressed }) => [styles.fabShadow, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
          >
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
              {search.isPending ? (
                <LoadingIndicator size={24} dotSize={4} color="#FFFFFF" />
              ) : (
                <FontAwesome6 name="magnifying-glass-location" size={22} color="#FFFFFF" solid />
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
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
  fabWrap: { position: 'absolute', right: 20, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 5 },
  fabLabel: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#0B2A5B',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  fabLabelText: { ...typography.caption, fontFamily: fonts.semiBold },
  fabSpot: { width: FAB, height: FAB, alignItems: 'center', justifyContent: 'center' },
  fabRing: { position: 'absolute', width: FAB, height: FAB, borderRadius: FAB / 2, borderWidth: 2 },
  fabShadow: {
    borderRadius: FAB / 2,
    shadowColor: '#0055D3',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fab: {
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  cardWrap: { marginBottom: 6 },
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
