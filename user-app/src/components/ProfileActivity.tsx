import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { BookingFilter, MyBookingsModal } from './MyBookingsModal';
import { MyOrdersModal, OrderFilter } from './MyOrdersModal';
import { YourProblemsModal } from './YourProblemsModal';
import { GradientCard } from './GradientCard';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useMyBookings } from '@/hooks/useBookings';
import { useMyProblems } from '@/hooks/useProblems';
import { ACTIVE_BOOKING_STATUSES } from '@/services/bookingsService';
import { useMyOrders } from '@/hooks/useOrders';
import { ACTIVE_ORDER_STATUSES, formatRupees } from '@/services/ordersService';
import { FullText } from '@/components/FullText';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];
interface Tile<F extends string> {
  icon: IconName;
  value: string;
  label: string;
  tint: string;
  /** The list filter this tile opens. */
  filter: F;
}

/** Stands in for a number while it loads: a short rounded bar in the tile's colour, gently pulsing. */
function LoadingBar({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });
  return <Animated.View style={[styles.loadingBar, { backgroundColor: color, opacity }]} />;
}

/**
 * A card of tappable stat tiles: the gradient header (title, View all), then a 3 × 2 grid of
 * white tiles, each with its own colour's icon and rim, opening the list on its filter.
 */
function StatsCard<F extends string>({
  title,
  icon,
  tiles,
  loading,
  viewAllLabel,
  onOpen,
}: {
  title: string;
  icon: IconName;
  tiles: Tile<F>[];
  loading: boolean;
  viewAllLabel: string;
  onOpen: (filter?: F) => void;
}) {
  const { colors, isDark } = useThemeColors();
  return (
    <GradientCard title={title} icon={icon} action={{ label: viewAllLabel, onPress: () => onOpen() }}>
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.label}
            onPress={() => onOpen(tile.filter)}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                borderColor: `${tile.tint}38`,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <LinearGradient
              pointerEvents="none"
              colors={[`${tile.tint}${isDark ? '30' : '22'}`, `${tile.tint}05`]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.tileHalo, { backgroundColor: `${tile.tint}2E` }]}>
              <View style={[styles.tileIcon, { backgroundColor: tile.tint }]}>
                <FontAwesome6 name={tile.icon} size={11} color="#FFFFFF" solid />
              </View>
            </View>
            {loading ? (
              <LoadingBar color={tile.tint} />
            ) : (
              <FullText style={[styles.tileValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {tile.value}
              </FullText>
            )}
            <FullText style={[styles.tileLabel, { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
              {tile.label}
            </FullText>
          </Pressable>
        ))}
      </View>
    </GradientCard>
  );
}

/**
 * The customer's own activity on Profile: how many Quick Books and problems they've had, how
 * many finished, are in progress, didn't happen, and how many workers they've rated — plus a
 * shortcut into My Bookings. Counted from the same lists My Bookings shows; a problem that a
 * worker took runs as a booking, so it is counted once (as that booking), never twice.
 */
export function ProfileActivity() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  // undefined = closed; a filter = open on it.
  const [bookingsFilter, setBookingsFilter] = useState<BookingFilter | undefined>();
  const [problemsVisible, setProblemsVisible] = useState(false);
  const bookings = useMyBookings();
  const problems = useMyProblems();

  const stats = useMemo(() => {
    const allBookings = bookings.data ?? [];
    const allProblems = problems.data ?? [];
    // Problems accepted before they became trips have no booking — count those from the problem.
    const legacyProblems = allProblems.filter((problem) => !problem.bookingRequestId);
    const quickBooks = allBookings.filter((booking) => !booking.problemPostId).length;
    const finished =
      allBookings.filter((booking) => booking.status === 'completed').length +
      legacyProblems.filter((problem) => problem.status === 'completed').length;
    const inProgress =
      allBookings.filter((booking) => ACTIVE_BOOKING_STATUSES.includes(booking.status)).length +
      legacyProblems.filter((problem) => problem.status === 'accepted' || problem.status === 'work_done').length;
    const notDone = allBookings.filter((booking) => booking.status === 'cancelled' || booking.status === 'expired').length;
    const rated =
      allBookings.filter((booking) => booking.workerRating != null).length +
      legacyProblems.filter((problem) => problem.workerRating != null).length;
    return { quickBooks, problemsPosted: allProblems.length, finished, inProgress, notDone, rated };
  }, [bookings.data, problems.data]);

  const loading = bookings.isLoading || problems.isLoading;
  // Problems posted (open ones too) live in Your Problems; every other tile is a My Bookings filter.
  const tiles: Tile<BookingFilter | 'posted'>[] = [
    { icon: 'bolt', value: String(stats.quickBooks), label: t('profile.activity.quickBooks'), tint: colors.primary, filter: 'quick' },
    { icon: 'clipboard-list', value: String(stats.problemsPosted), label: t('profile.activity.problemsPosted'), tint: '#7C3AED', filter: 'posted' },
    { icon: 'circle-check', value: String(stats.finished), label: t('profile.activity.finished'), tint: brandColors.success, filter: 'finished' },
    {
      icon: 'person-running',
      value: String(stats.inProgress),
      label: t('profile.activity.inProgress'),
      tint: brandColors.warning,
      filter: 'active',
    },
    { icon: 'ban', value: String(stats.notDone), label: t('profile.activity.notDone'), tint: brandColors.error, filter: 'notDone' },
    { icon: 'star', value: String(stats.rated), label: t('profile.activity.rated'), tint: '#F59E0B', filter: 'rated' },
  ];

  return (
    <>
      <StatsCard
        title={t('profile.activity.title')}
        icon="screwdriver-wrench"
        tiles={tiles}
        loading={loading}
        viewAllLabel={t('profile.viewAll')}
        onOpen={(filter) => (filter === 'posted' ? setProblemsVisible(true) : setBookingsFilter(filter ?? 'all'))}
      />
      <MyBookingsModal visible={!!bookingsFilter} initialFilter={bookingsFilter} onClose={() => setBookingsFilter(undefined)} />
      <YourProblemsModal visible={problemsVisible} onClose={() => setProblemsVisible(false)} />
    </>
  );
}

/**
 * The customer's Bazaar shop orders on Profile: lists sent, completed, in progress, ones that
 * didn't happen (declined, expired, cancelled), how many they rated, and what completed orders
 * came to — plus a shortcut into My Orders.
 */
export function ProfileOrders() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [ordersFilter, setOrdersFilter] = useState<OrderFilter | undefined>();
  const orders = useMyOrders();

  const stats = useMemo(() => {
    const all = orders.data ?? [];
    const completed = all.filter((order) => order.status === 'completed');
    return {
      sent: all.length,
      completed: completed.length,
      inProgress: all.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status)).length,
      notDone: all.filter((order) => ['cancelled', 'declined', 'expired'].includes(order.status)).length,
      rated: all.filter((order) => order.shopRating != null).length,
      spent: completed.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0),
    };
  }, [orders.data]);

  const tiles: Tile<OrderFilter>[] = [
    { icon: 'paper-plane', value: String(stats.sent), label: t('profile.orders.sent'), tint: colors.primary, filter: 'all' },
    { icon: 'bag-shopping', value: String(stats.completed), label: t('profile.orders.completed'), tint: brandColors.success, filter: 'completed' },
    {
      icon: 'basket-shopping',
      value: String(stats.inProgress),
      label: t('profile.orders.inProgress'),
      tint: brandColors.warning,
      filter: 'active',
    },
    { icon: 'ban', value: String(stats.notDone), label: t('profile.orders.notDone'), tint: brandColors.error, filter: 'notDone' },
    { icon: 'star', value: String(stats.rated), label: t('profile.orders.rated'), tint: '#F59E0B', filter: 'rated' },
    { icon: 'indian-rupee-sign', value: formatRupees(stats.spent), label: t('profile.orders.spent'), tint: '#0EA5E9', filter: 'completed' },
  ];

  return (
    <>
      <StatsCard
        title={t('profile.orders.title')}
        icon="basket-shopping"
        tiles={tiles}
        loading={orders.isLoading}
        viewAllLabel={t('profile.viewAll')}
        onOpen={(filter) => setOrdersFilter(filter ?? 'all')}
      />
      <MyOrdersModal visible={!!ordersFilter} initialFilter={ordersFilter} onClose={() => setOrdersFilter(undefined)} />
    </>
  );
}

const styles = StyleSheet.create({
  // Space on both sides, so the next section never sits flush against this card.
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 12,
    marginTop: 4,
    marginBottom: 16,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  headIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.body, fontFamily: fonts.semiBold, flex: 1 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, borderRadius: 14, borderWidth: 1, paddingHorizontal: 11 },
  viewAllText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 16, includeFontPadding: false },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Compact: icon + number on one line, the label under it — every tile the same height.
  tile: { width: '31.6%', flexGrow: 1, borderRadius: 14, borderWidth: 1, paddingTop: 10, paddingBottom: 9, paddingHorizontal: 6, alignItems: 'center', overflow: 'hidden' },
  tileHalo: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  // Same height as the number, so nothing moves when it arrives.
  loadingBar: { width: 30, height: 12, borderRadius: 6, marginVertical: 5.5 },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  watermark: { position: 'absolute', right: -24, top: -24, transform: [{ rotate: '-14deg' }] },
  tileIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontFamily: fonts.semiBold, fontSize: 18, lineHeight: 23, includeFontPadding: false, flexShrink: 1 },
  tileLabel: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 16, marginTop: 5, textAlign: 'center', includeFontPadding: false },
});
