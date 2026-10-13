import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { MyBookingsModal } from './MyBookingsModal';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';
import { useMyBookings } from '@/hooks/useBookings';
import { useMyProblems } from '@/hooks/useProblems';
import { ACTIVE_BOOKING_STATUSES } from '@/services/bookingsService';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

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
  const tiles: { icon: IconName; value: number; label: string; tint: string }[] = [
    { icon: 'bolt', value: stats.quickBooks, label: t('profile.activity.quickBooks'), tint: colors.primary },
    { icon: 'clipboard-list', value: stats.problemsPosted, label: t('profile.activity.problemsPosted'), tint: '#7C3AED' },
    { icon: 'circle-check', value: stats.finished, label: t('profile.activity.finished'), tint: brandColors.success },
    { icon: 'person-running', value: stats.inProgress, label: t('profile.activity.inProgress'), tint: brandColors.warning },
    { icon: 'ban', value: stats.notDone, label: t('profile.activity.notDone'), tint: brandColors.error },
    { icon: 'star', value: stats.rated, label: t('profile.activity.rated'), tint: '#F59E0B' },
  ];

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.textMuted }]}>{t('profile.activity.title')}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.grid}>
          {tiles.map((tile) => (
            <View key={tile.label} style={styles.tile}>
              <View style={[styles.tileIcon, { backgroundColor: `${tile.tint}16` }]}>
                <FontAwesome6 name={tile.icon} size={14} color={tile.tint} solid />
              </View>
              <Text style={[styles.tileValue, { color: colors.text }]}>{loading ? '–' : tile.value}</Text>
              <Text style={[styles.tileLabel, { color: colors.textMuted }]} numberOfLines={2}>
                {tile.label}
              </Text>
            </View>
          ))}
        </View>
        <Pressable
          style={({ pressed }) => [styles.viewAll, { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          onPress={() => setBookingsVisible(true)}
        >
          <FontAwesome6 name="clock-rotate-left" size={13} color={colors.primary} solid />
          <Text style={[styles.viewAllText, { color: colors.primary }]}>{t('profile.activity.viewAll')}</Text>
          <FontAwesome6 name="chevron-right" size={11} color={colors.primary} solid />
        </Pressable>
      </View>
      <MyBookingsModal visible={bookingsVisible} onClose={() => setBookingsVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22 },
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
