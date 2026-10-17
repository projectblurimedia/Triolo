import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useMyBookings } from '@/hooks/useBookings';
import { useMyOrders } from '@/hooks/useOrders';
import { ACTIVE_BOOKING_STATUSES } from '@/services/bookingsService';
import { isOrderOpen, orderStatusTitleKey } from '@/services/ordersService';
import { openBookingTracker } from '@/state/bookingTrackerStore';
import { openOrderTracker } from '@/state/orderTrackerStore';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

const MAX_ROWS = 4;

interface Step {
  key: string;
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  gradient: readonly [string, string];
  name: string;
  stepTitle: string;
  hint: string;
  action: string;
  createdAt: string;
  onPress: () => void;
}

/** A small pulsing dot — "this is live". */
function LiveDot({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.dotWrap}>
      <Animated.View
        style={[
          styles.dotRing,
          {
            backgroundColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
          },
        ]}
      />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

/**
 * Home's "Continue where you left off": every booking (Quick Book or a problem's trip) and shop
 * order still in progress — including a finished order waiting for its rating — each one tap
 * from its tracking screen, so nothing has to be dug out of My Bookings / My Orders after the
 * app was closed or minimised. Renders nothing when nothing is in progress.
 */
export function ContinueSteps() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const bookings = useMyBookings();
  const orders = useMyOrders();

  const skills = (keys: string[]) => keys.map((key) => t(`workerProfile.skills.${key}`)).join(', ');

  const steps: Step[] = [
    ...(bookings.data ?? [])
      .filter((booking) => ACTIVE_BOOKING_STATUSES.includes(booking.status))
      .map<Step>((booking) => {
        const workerName = booking.worker?.fullName ?? null;
        return {
          key: `booking-${booking.id}`,
          icon: booking.problemPostId ? 'clipboard-list' : 'bolt',
          gradient: headerGradient,
          name: workerName ?? t('continueSteps.searching'),
          stepTitle: `${t(`tracking.status.${booking.status}.title`)} · ${skills(booking.skillCategories)}`,
          hint: t(`tracking.status.${booking.status}.message`, { name: workerName ?? t('tracking.yourWorker') }),
          action: t('continueSteps.continue'),
          createdAt: booking.createdAt,
          onPress: () => openBookingTracker(booking.id),
        };
      }),
    ...(orders.data ?? []).filter(isOrderOpen).map<Step>((order) => {
      const toRate = order.status === 'completed';
      return {
        key: `order-${order.id}`,
        icon: toRate ? 'star' : 'basket-shopping',
        gradient: headerGradient,
        name: order.shop.name,
        stepTitle: `${t(orderStatusTitleKey(order))} · ${t('orders.itemsCount', { count: order.items.length })}`,
        hint: toRate ? '' : t(`orders.status.${order.status}.message`, { shop: order.shop.name, name: order.shop.name }),
        action: t(toRate ? 'continueSteps.rate' : 'continueSteps.continue'),
        createdAt: order.createdAt,
        onPress: () => openOrderTracker(order.id),
      };
    }),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (steps.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <LiveDot color={brandColors.pending} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('continueSteps.title')}</Text>
      </View>

      {steps.slice(0, MAX_ROWS).map((step) => (
        <Pressable
          key={step.key}
          onPress={step.onPress}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: `${brandColors.pending}0A`, borderColor: `${brandColors.pending}99`, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <LinearGradient colors={step.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
            <FontAwesome6 name={step.icon} size={17} color="#FFFFFF" solid />
          </LinearGradient>
          <View style={styles.text}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {step.name}
              </Text>
              <View style={[styles.pendingTag, { backgroundColor: `${brandColors.pending}1A` }]}>
                <Text style={[styles.pendingText, { color: brandColors.pending }]}>{t('continueSteps.pending')}</Text>
              </View>
            </View>
            <Text style={[styles.step, { color: step.gradient[0] }]} numberOfLines={1}>
              {step.stepTitle}
            </Text>
            {step.hint ? (
              <Text style={[styles.hint, { color: colors.textMuted }]} numberOfLines={2}>
                {step.hint}
              </Text>
            ) : null}
          </View>
          <LinearGradient colors={step.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.go}>
            <Text style={styles.goText}>{step.action}</Text>
            <FontAwesome6 name="chevron-right" size={10} color="#FFFFFF" solid />
          </LinearGradient>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionTitle: { ...typography.subheading, fontFamily: fonts.semiBold, flex: 1 },
  dotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  dotRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 10,
  },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
  name: { ...typography.body, fontFamily: fonts.semiBold, flexShrink: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingTag: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  pendingText: { fontFamily: fonts.semiBold, fontSize: 10 },
  step: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  hint: { ...typography.caption, fontSize: 11, lineHeight: 15 },
  go: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 8 },
  goText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 12 },
});
