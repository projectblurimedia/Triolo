import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';
import { useAcceptBookingOffer, useBookingOffers, useDeclineBookingOffer } from '@/hooks/useBookingOffers';
import { useMyJobs } from '@/hooks/useJobs';
import { useAssignedProblems } from '@/hooks/useProblems';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { PendingOffer } from '@/services/bookingOffersService';
import { ACTIVE_JOB_STATUSES, WorkerJob } from '@/services/jobsService';
import { AssignedProblem } from '@/services/problemsService';
import { MainTabParamList } from '@/navigation/types';
import { showToast } from '@/state/toastStore';
import { openJob } from '@/state/jobFocusStore';
import { ApiError } from '@/services/apiClient';
import { formatDistance } from '@/utils/formatDistance';

type Tab = 'requests' | 'active' | 'history';
type HistoryEntry =
  | { kind: 'job'; id: string; createdAt: string; active: boolean; job: WorkerJob }
  | { kind: 'problem'; id: string; createdAt: string; active: boolean; problem: AssignedProblem };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PURPLE = '#7C3AED';
const STAR_COLOR = '#FBBF24';

// Manual, not toLocale* — Hermes on Android doesn't reliably ship full Intl data.
function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Every booking in one place for the worker:
 *  - Requests: open Quick Book offers to Accept / Decline (also pushed, and popped up full
 *    screen by IncomingJobModal while the app is open)
 *  - Active: Quick Book jobs and Your Problems jobs in progress — a Quick Book job opens its
 *    live job screen (JobTrackingModal: map, directions, start trip, PIN, work done); a problem
 *    job is managed on Home
 *  - History: finished and cancelled jobs, with the customer's rating and feedback
 */
export function BookingsScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [tab, setTab] = useState<Tab>('requests');
  const [refreshing, setRefreshing] = useState(false);
  const { data: offers, isLoading: offersLoading, refetch: refetchOffers } = useBookingOffers();
  const jobs = useMyJobs();
  const workerProfile = useMyWorkerProfile();
  const problems = useAssignedProblems(workerProfile.data?.verificationStatus === 'verified');
  const acceptMutation = useAcceptBookingOffer();
  const declineMutation = useDeclineBookingOffer();

  const entries = useMemo<HistoryEntry[]>(() => {
    const fromJobs: HistoryEntry[] = (jobs.data ?? []).map((job) => ({
      kind: 'job',
      id: job.id,
      createdAt: job.createdAt,
      active: ACTIVE_JOB_STATUSES.includes(job.status),
      job,
    }));
    // A problem accepted since problems became trips is already listed as its trip (job).
    const fromProblems: HistoryEntry[] = (problems.data ?? []).filter((problem) => !problem.bookingRequestId).map((problem) => ({
      kind: 'problem',
      id: problem.id,
      createdAt: problem.createdAt,
      active: problem.status !== 'completed',
      problem,
    }));
    return [...fromJobs, ...fromProblems].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [jobs.data, problems.data]);

  const activeEntries = entries.filter((entry) => entry.active);
  const historyEntries = entries.filter((entry) => !entry.active);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchOffers(), jobs.refetch(), problems.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAccept = (offer: PendingOffer) => {
    acceptMutation.mutate(offer.bookingRequestId, {
      onSuccess: () => {
        showToast({ variant: 'success', title: t('bookings.acceptedToastTitle'), message: t('bookings.acceptedToastMessage') });
        Notifications.dismissNotificationAsync(offer.bookingRequestId).catch(() => {});
        jobs.refetch();
        openJob(offer.bookingRequestId);
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

  const renderOffer = ({ item }: { item: PendingOffer }) => {
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
            style={({ pressed }) => [styles.declineButton, { borderColor: colors.border, opacity: pressed || declining ? 0.8 : 1 }]}
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
            style={({ pressed }) => [styles.acceptButton, { backgroundColor: colors.primary, opacity: pressed || accepting ? 0.8 : 1 }]}
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
  };

  const statusColor = (status: string): string => {
    if (status === 'completed') return brandColors.success;
    if (status === 'cancelled') return brandColors.error;
    if (status === 'work_done') return brandColors.warning;
    return colors.primary;
  };

  const renderEntry = ({ item }: { item: HistoryEntry }) => {
    const isJob = item.kind === 'job';
    const skills = (isJob ? item.job.skillCategories : item.problem.skillCategories).map((key) => t(`workerProfile.skills.${key}`)).join(', ');
    const status = isJob ? item.job.status : item.problem.status;
    const statusLabel = isJob ? t(`job.status.${status}.title`) : t(`problems.status.${status}`);
    const customer = isJob ? item.job.customerFullName : item.problem.customerFullName;
    const rating = isJob ? item.job.workerRating : item.problem.workerRating;
    const review = isJob ? item.job.workerReview : item.problem.workerReview;
    const tone = statusColor(status);
    const isProblem = !isJob || !!item.job.problemPostId;
    const accent = isProblem ? PURPLE : colors.primary;
    const amount = isJob ? item.job.quotationAmount : item.problem.quotationAmount;

    return (
      <Pressable
        style={[styles.card, styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => (isJob ? openJob(item.job.id) : navigation.navigate('Home'))}
      >
        <View style={[styles.entryIcon, { backgroundColor: `${accent}1A` }]}>
          <FontAwesome6 name={isProblem ? 'clipboard-list' : 'bolt'} size={16} color={accent} solid />
        </View>
        <View style={styles.entryBody}>
          <View style={styles.entryTitleRow}>
            <Text style={[styles.entryTitle, { color: colors.text }]} numberOfLines={1}>
              {skills}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: `${tone}1A` }]}>
              <Text style={[styles.statusText, { color: tone }]} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text style={[styles.entryMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {t(isProblem ? 'bookings.typeProblem' : 'bookings.typeQuickBook')} · {customer} · {formatDate(item.createdAt)}
            {amount != null ? ` · ₹${amount.toLocaleString('en-IN')}` : ''}
          </Text>
          {rating ? (
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <FontAwesome6 key={star} name="star" size={11} color={star <= rating ? STAR_COLOR : colors.border} solid />
              ))}
              {review ? (
                <Text style={[styles.entryMeta, styles.reviewText, { color: colors.text }]} numberOfLines={1}>
                  “{review}”
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
        <FontAwesome6 name="chevron-right" size={12} color={colors.textMuted} solid />
      </Pressable>
    );
  };

  const renderEmpty = (icon: React.ComponentProps<typeof FontAwesome6>['name'], title: string, message: string) => (
    <View style={styles.centerWrap}>
      <FontAwesome6 name={icon} size={22} color={colors.textMuted} solid />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{message}</Text>
    </View>
  );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'requests', label: t('bookings.tabRequests'), count: offers?.length ?? 0 },
    { key: 'active', label: t('bookings.tabActive'), count: activeEntries.length },
    { key: 'history', label: t('bookings.tabHistory'), count: 0 },
  ];

  const loading = tab === 'requests' ? offersLoading : jobs.isLoading;
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />;

  return (
    <ScreenContainer edges={['left', 'right']}>
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
              {option.count > 0 ? (
                <View style={[styles.countBadge, { backgroundColor: option.key === 'requests' ? brandColors.error : colors.primary }]}>
                  <Text style={styles.countText}>{option.count > 9 ? '9+' : option.count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <LoadingIndicator color={colors.primary} />
        </View>
      ) : tab === 'requests' ? (
        <FlatList showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
          data={offers ?? []}
          keyExtractor={(item) => item.offerId}
          contentContainerStyle={styles.listContent}
          renderItem={renderOffer}
          refreshControl={refreshControl}
          ListEmptyComponent={renderEmpty('bell', t('bookings.emptyTitle'), t('bookings.emptyMessage'))}
        />
      ) : (
        <FlatList showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
          data={tab === 'active' ? activeEntries : historyEntries}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={styles.listContent}
          renderItem={renderEntry}
          refreshControl={refreshControl}
          ListEmptyComponent={
            tab === 'active'
              ? renderEmpty('person-digging', t('bookings.emptyActiveTitle'), t('bookings.emptyActiveMessage'))
              : renderEmpty('clock-rotate-left', t('bookings.emptyHistoryTitle'), t('bookings.emptyHistoryMessage'))
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 14 },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 11 },
  segmentText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
  countBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#FFFFFF', fontSize: 10, fontFamily: fonts.semiBold },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 40 },
  emptyTitle: { ...typography.subheading, fontFamily: fonts.semiBold, textAlign: 'center' },
  emptyMessage: { ...typography.body, textAlign: 'center', lineHeight: 20 },
  // Extra bottom padding clears the floating CustomTabBar.
  listContent: { paddingBottom: 120, flexGrow: 1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row' },
  distancePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  distanceText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  tagText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 11 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  declineButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 12 },
  declineButtonText: { ...typography.body, fontFamily: fonts.medium },
  acceptButton: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12 },
  acceptButtonText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  entryCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  entryIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  entryBody: { flex: 1, gap: 3 },
  entryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryTitle: { ...typography.body, fontFamily: fonts.semiBold, flex: 1 },
  statusPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '50%' },
  statusText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10 },
  entryMeta: { ...typography.caption, fontSize: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  reviewText: { flex: 1, marginLeft: 6, fontStyle: 'italic' },
});
