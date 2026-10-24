import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingIndicator } from './LoadingIndicator';
import { STAR_COLOR } from './RatingStars';
import { YourProblemsModal } from './YourProblemsModal';
import { ToastHost } from './ToastHost';
import { useMyBookings } from '@/hooks/useBookings';
import { useMyProblems } from '@/hooks/useProblems';
import { ACTIVE_BOOKING_STATUSES, CustomerBooking } from '@/services/bookingsService';
import { ProblemPost } from '@/services/problemsService';
import { openBookingTracker } from '@/state/bookingTrackerStore';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { PullToRefresh } from './PullToRefresh';
import { bookingStatusTitle } from '@/utils/bookingStatusText';
import { CountBadge } from './CountBadge';

interface MyBookingsModalProps {
  visible: boolean;
  onClose: () => void;
}

type Tab = 'active' | 'history';
type Entry =
  | { kind: 'booking'; id: string; createdAt: string; active: boolean; booking: CustomerBooking }
  | { kind: 'problem'; id: string; createdAt: string; active: boolean; problem: ProblemPost };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PROBLEM_ACTIVE = ['accepted', 'work_done'];
const PURPLE = '#7C3AED';

// Manual, not toLocale* — Hermes on Android doesn't reliably ship full Intl data.
function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Every booking in one place: Quick Book bookings and Your Problems jobs that a worker took
 * on, split into Active and History, newest first. A Quick Book entry opens its live tracking
 * screen (BookingTrackingModal, root-mounted); a problem opens Your Problems, where its
 * actions live. Problems nobody has taken yet stay in Your Problems only — they aren't
 * bookings yet.
 */
export function MyBookingsModal({ visible, onClose }: MyBookingsModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('active');
  const [problemsVisible, setProblemsVisible] = useState(false);
  const bookings = useMyBookings(visible);
  const problems = useMyProblems(visible);
  const [refreshing, setRefreshing] = useState(false);

  const entries = useMemo<Entry[]>(() => {
    const fromBookings: Entry[] = (bookings.data ?? []).map((booking) => ({
      kind: 'booking',
      id: booking.id,
      createdAt: booking.createdAt,
      active: ACTIVE_BOOKING_STATUSES.includes(booking.status),
      booking,
    }));
    const fromProblems: Entry[] = (problems.data ?? [])
      // A problem accepted since problems became trips is already listed as its booking.
      .filter((problem) => problem.status !== 'open' && problem.status !== 'closed' && !problem.bookingRequestId)
      .map((problem) => ({
        kind: 'problem',
        id: problem.id,
        createdAt: problem.createdAt,
        active: PROBLEM_ACTIVE.includes(problem.status),
        problem,
      }));
    return [...fromBookings, ...fromProblems].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [bookings.data, problems.data]);

  const shown = entries.filter((entry) => (tab === 'active' ? entry.active : !entry.active));
  const activeCount = entries.filter((entry) => entry.active).length;
  const loading = bookings.isLoading || problems.isLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([bookings.refetch(), problems.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const statusColor = (status: string): string => {
    if (status === 'completed') return brandColors.success;
    if (status === 'cancelled') return brandColors.error;
    if (status === 'expired') return brandColors.warning;
    if (status === 'work_done') return brandColors.warning;
    return colors.primary;
  };

  const renderEntry = ({ item }: { item: Entry }) => {
    const isBooking = item.kind === 'booking';
    const skills = (isBooking ? item.booking.skillCategories : item.problem.skillCategories)
      .map((key) => t(`workerProfile.skills.${key}`))
      .join(', ');
    const status = isBooking ? item.booking.status : item.problem.status;
    const statusLabel = isBooking ? bookingStatusTitle(item.booking, t) : t(`yourProblems.status.${status}`);
    const workerName = isBooking ? item.booking.worker?.fullName : item.problem.acceptedWorkerFullName;
    const rating = isBooking ? item.booking.workerRating : item.problem.workerRating;
    const tone = statusColor(status);
    const isProblem = !isBooking || !!item.booking.problemPostId;
    const accent = isProblem ? PURPLE : colors.primary;
    const amount = isBooking ? item.booking.quotationAmount : item.problem.quotationAmount;

    return (
      <Pressable
        style={[
          styles.card,
          item.active
            ? { backgroundColor: `${brandColors.pending}0A`, borderColor: `${brandColors.pending}99` }
            : { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onPress={() => (isBooking ? openBookingTracker(item.booking.id) : setProblemsVisible(true))}
      >
        <View style={[styles.icon, { backgroundColor: `${accent}1A` }]}>
          <FontAwesome6 name={isProblem ? 'clipboard-list' : 'bolt'} size={16} color={accent} solid />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {skills}
            </Text>
            <View style={[styles.pill, { backgroundColor: `${tone}1A` }]}>
              <Text style={[styles.pillText, { color: tone }]} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {t(isProblem ? 'myBookings.typeProblem' : 'myBookings.typeQuickBook')} · {formatDate(item.createdAt)}
            {amount != null ? ` · ₹${amount.toLocaleString('en-IN')}` : ''}
          </Text>
          {workerName ? (
            <View style={styles.workerRow}>
              <FontAwesome6 name="user" size={10} color={colors.textMuted} solid />
              <Text style={[styles.meta, { color: colors.text }]} numberOfLines={1}>
                {workerName}
              </Text>
              {rating ? (
                <View style={styles.ratingRow}>
                  <FontAwesome6 name="star" size={10} color={STAR_COLOR} solid />
                  <Text style={[styles.meta, { color: colors.text }]}>{rating}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <FontAwesome6 name="chevron-right" size={12} color={colors.textMuted} solid />
      </Pressable>
    );
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'active', label: t('myBookings.active') },
    { key: 'history', label: t('myBookings.history') },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.close')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.titleGroup}>
              <Text style={styles.headerTitle}>{t('myBookings.title')}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t('myBookings.subtitle')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Active / History sit below the header — headers carry only a title and subtitle. */}
        <View style={[styles.segment, { backgroundColor: `${colors.primary}10` }]}>
          {tabs.map((option) => {
            const active = tab === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setTab(option.key)}
                style={[styles.segmentItem, active ? { backgroundColor: colors.surface } : null]}
              >
                <Text style={[styles.segmentText, { color: active ? colors.primary : colors.textMuted }]}>{option.label}</Text>
                {option.key === 'active' ? <CountBadge count={activeCount} /> : null}
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.center}>
            <LoadingIndicator size={40} dotSize={6} color={colors.primary} />
          </View>
        ) : (
          <PullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
            <FlatList
              data={shown}
              keyExtractor={(entry) => `${entry.kind}-${entry.id}`}
              renderItem={renderEntry}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}14` }]}>
                    <FontAwesome6 name="calendar-check" size={22} color={colors.primary} solid />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    {t(tab === 'active' ? 'myBookings.emptyActiveTitle' : 'myBookings.emptyHistoryTitle')}
                  </Text>
                  <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{t('myBookings.emptyMessage')}</Text>
                </View>
              }
            />
          </PullToRefresh>
        )}
        <ToastHost />
      </View>

      <YourProblemsModal visible={problemsVisible} onClose={() => setProblemsVisible(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 14, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  titleGroup: { marginLeft: 14, flex: 1 },
  headerTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', lineHeight: 20 },
  headerSubtitle: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 14, marginTop: 2 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, margin: 16, marginBottom: 6 },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 11 },
  // Fixed line height, no font padding: the text and the red count line up in the middle.
  segmentText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 18, includeFontPadding: false, textAlignVertical: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingTop: 10, paddingBottom: 40, flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...typography.body, fontFamily: fonts.semiBold, flex: 1 },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '50%' },
  pillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10 },
  meta: { ...typography.caption, fontSize: 12 },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...typography.subheading, fontFamily: fonts.semiBold, textAlign: 'center' },
  emptyMessage: { ...typography.body, textAlign: 'center', lineHeight: 20 },
});
