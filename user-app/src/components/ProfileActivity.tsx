import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { MyBookingsModal } from './MyBookingsModal';
import { MyOrdersModal } from './MyOrdersModal';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';
import { useMyBookings } from '@/hooks/useBookings';
import { useMyProblems } from '@/hooks/useProblems';
import { ACTIVE_BOOKING_STATUSES } from '@/services/bookingsService';
import { useMyOrders } from '@/hooks/useOrders';
import { ACTIVE_ORDER_STATUSES, formatRupees } from '@/services/ordersService';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];
interface Tile {
  icon: IconName;
  value: string;
  label: string;
  tint: string;
}

/** A titled card of stat tiles with a "view all" row at the bottom. */
function StatsCard({
  title,
  tiles,
  loading,
  viewAllIcon,
  viewAllLabel,
  onViewAll,
}: {
  title: string;
  tiles: Tile[];
  loading: boolean;
  viewAllIcon: IconName;
  viewAllLabel: string;
  onViewAll: () => void;
}) {
  const { colors } = useThemeColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.textMuted }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.grid}>
          {tiles.map((tile) => (
            <View key={tile.label} style={styles.tile}>
              <View style={[styles.tileIcon, { backgroundColor: `${tile.tint}16` }]}>
                <FontAwesome6 name={tile.icon} size={14} color={tile.tint} solid />
              </View>
              <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {loading ? '–' : tile.value}
              </Text>
              <Text style={[styles.tileLabel, { color: colors.textMuted }]} numberOfLines={2}>
                {tile.label}
              </Text>
            </View>
          ))}
        </View>
        <Pressable
          style={({ pressed }) => [styles.viewAll, { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          onPress={onViewAll}
        >
          <FontAwesome6 name={viewAllIcon} size={13} color={colors.primary} solid />
          <Text style={[styles.viewAllText, { color: colors.primary }]}>{viewAllLabel}</Text>
          <FontAwesome6 name="chevron-right" size={11} color={colors.primary} solid />
        </Pressable>
      </View>
    </View>
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
  const [bookingsVisible, setBookingsVisible] = useState(false);
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
  const tiles: Tile[] = [
    { icon: 'bolt', value: String(stats.quickBooks), label: t('profile.activity.quickBooks'), tint: colors.primary },
    { icon: 'clipboard-list', value: String(stats.problemsPosted), label: t('profile.activity.problemsPosted'), tint: '#7C3AED' },
    { icon: 'circle-check', value: String(stats.finished), label: t('profile.activity.finished'), tint: brandColors.success },
    {
      icon: 'person-running',
      value: String(stats.inProgress),
      label: t('profile.activity.inProgress'),
      tint: brandColors.warning,
    },
    { icon: 'ban', value: String(stats.notDone), label: t('profile.activity.notDone'), tint: brandColors.error },
    { icon: 'star', value: String(stats.rated), label: t('profile.activity.rated'), tint: '#F59E0B' },
  ];

  return (
    <>
      <StatsCard
        title={t('profile.activity.title')}
        tiles={tiles}
        loading={loading}
        viewAllIcon="clock-rotate-left"
        viewAllLabel={t('profile.activity.viewAll')}
        onViewAll={() => setBookingsVisible(true)}
      />
      <MyBookingsModal visible={bookingsVisible} onClose={() => setBookingsVisible(false)} />
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
  const [ordersVisible, setOrdersVisible] = useState(false);
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

  const tiles: Tile[] = [
    { icon: 'paper-plane', value: String(stats.sent), label: t('profile.orders.sent'), tint: colors.primary },
    { icon: 'bag-shopping', value: String(stats.completed), label: t('profile.orders.completed'), tint: brandColors.success },
    {
      icon: 'basket-shopping',
      value: String(stats.inProgress),
      label: t('profile.orders.inProgress'),
      tint: brandColors.warning,
    },
    { icon: 'ban', value: String(stats.notDone), label: t('profile.orders.notDone'), tint: brandColors.error },
    { icon: 'star', value: String(stats.rated), label: t('profile.orders.rated'), tint: '#F59E0B' },
    { icon: 'indian-rupee-sign', value: formatRupees(stats.spent), label: t('profile.orders.spent'), tint: '#0EA5E9' },
  ];

  return (
    <>
      <StatsCard
        title={t('profile.orders.title')}
        tiles={tiles}
        loading={orders.isLoading}
        viewAllIcon="receipt"
        viewAllLabel={t('profile.orders.viewAll')}
        onViewAll={() => setOrdersVisible(true)}
      />
      <MyOrdersModal visible={ordersVisible} onClose={() => setOrdersVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  // Space on both sides, so the next section never sits flush against the "view all" row.
  section: { marginTop: 4, marginBottom: 22 },
  title: { ...typography.caption, fontFamily: fonts.semiBold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8 },
  tile: { width: '33.33%', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, gap: 4 },
  tileIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tileValue: { fontFamily: fonts.semiBold, fontSize: 20, lineHeight: 26 },
  tileLabel: { ...typography.caption, fontSize: 11, textAlign: 'center', lineHeight: 14 },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  viewAllText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
});
