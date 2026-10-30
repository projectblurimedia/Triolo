import React, { useEffect, useMemo, useState } from 'react';
import { placeName } from '@/utils/formatAddress';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import * as Notifications from 'expo-notifications';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useAcceptBookingOffer, useBookingOffers, useDeclineBookingOffer, useOfferStats } from '@/hooks/useBookingOffers';
import { useMyJobs } from '@/hooks/useJobs';
import { useAssignedProblems } from '@/hooks/useProblems';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { ShopOrdersList } from '@/components/ShopOrdersList';
import { useShopOrders } from '@/hooks/useShopOrders';
import { PendingOffer } from '@/services/bookingOffersService';
import { ACTIVE_JOB_STATUSES, WorkerJob } from '@/services/jobsService';
import { AssignedProblem } from '@/services/problemsService';
import { MainTabParamList } from '@/navigation/types';
import { showToast } from '@/state/toastStore';
import { openJob } from '@/state/jobFocusStore';
import { ApiError } from '@/services/apiClient';
import { formatDistance } from '@/utils/formatDistance';
import { PullToRefresh } from '@/components/PullToRefresh';
import { FindJobsButton } from '@/components/FindJobsButton';
import { LocationNeededCard } from '@/components/LocationNeededCard';
import { useAttentionCounts } from '@/hooks/useAttentionCounts';
import { useMyJobPost } from '@/hooks/useJobPost';
import { ActivityFilter } from '@/components/ActivityFilter';
import { JobPostActivity } from '@/components/JobPostActivity';
import { ALL_TIME, DateRange, inRange, rangeLabel } from '@/components/DateRangeSheet';
import { ActivitySummary } from '@/components/ActivitySummary';
import { formatRupees } from '@/services/shopOrdersService';

type Side = 'services' | 'shop' | 'job';
// Activity is a record of what you did: requests waiting for an answer live in New for you.
type JobFilter = 'all' | 'active' | 'done' | 'cancelled';
type ShopFilter = 'all' | 'active' | 'done' | 'cancelled';
type Row = { kind: 'offer'; key: string; offer: PendingOffer } | { kind: 'entry'; key: string; entry: HistoryEntry };
const SIDE_ICONS = {
  services: 'screwdriver-wrench',
  shop: 'store',
  job: 'briefcase',
} as const;
type HistoryEntry =
  | {
      kind: 'job';
      id: string;
      createdAt: string;
      active: boolean;
      job: WorkerJob;
    }
  | {
      kind: 'problem';
      id: string;
      createdAt: string;
      active: boolean;
      problem: AssignedProblem;
    };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Post a Problem jobs have their own colour and icon, so they're never mistaken for a Quick Book.
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
  // One list per side, narrowed by a filter (no separate tabs).
  const [jobFilter, setJobFilter] = useState<JobFilter>('all');
  // Each time the tab comes into view its list is placed afresh: a list laid out while the tab
  // was hidden could rest with the hidden pull-to-refresh room showing as a gap above the filter.
  const isFocused = useIsFocused();
  const [visit, setVisit] = useState(0);
  useEffect(() => {
    if (isFocused) setVisit((count) => count + 1);
  }, [isFocused]);
  const [shopFilter, setShopFilter] = useState<ShopFilter>('all');
  // From – to dates (both sides share them).
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const [refreshing, setRefreshing] = useState(false);
  const { data: offers, isLoading: offersLoading, refetch: refetchOffers } = useBookingOffers();
  const jobs = useMyJobs();
  const workerProfile = useMyWorkerProfile();
  const problems = useAssignedProblems(workerProfile.data?.verificationStatus === 'verified');
  const acceptMutation = useAcceptBookingOffer();
  const declineMutation = useDeclineBookingOffer();
  const businessProfile = useMyBusinessProfile();
  const isWorker = workerProfile.data?.verificationStatus === 'verified';
  const isShop = businessProfile.data?.verificationStatus === 'verified';
  // A partner with both capabilities switches between their worker jobs and their shop orders.
  // Opened from a shop order (Home's shop card, an order notification) it starts on orders.
  const route = useRoute<RouteProp<MainTabParamList, 'Bookings'>>();
  const [pickedSide, setPickedSide] = useState<Side | null>(route.params?.mode === 'orders' ? 'shop' : route.params?.mode === 'jobs' ? 'services' : null);
  useEffect(() => {
    if (route.params?.mode) setPickedSide(route.params.mode === 'orders' ? 'shop' : 'services');
    const tab = route.params?.tab;
    if (tab) setJobFilter(tab === 'history' ? 'done' : tab === 'requests' ? 'all' : tab);
    const orderTab = route.params?.orderTab;
    if (orderTab) setShopFilter(orderTab === 'history' ? 'done' : orderTab === 'new' ? 'all' : orderTab);
  }, [route.params?.mode, route.params?.tab, route.params?.orderTab, route.params?.linkedAt]);
  const jobPost = useMyJobPost();
  const shopOrders = useShopOrders(isShop);
  const attention = useAttentionCounts();

  const entries = useMemo<HistoryEntry[]>(() => {
    const fromJobs: HistoryEntry[] = (jobs.data ?? []).map((job) => ({
      kind: 'job',
      id: job.id,
      createdAt: job.createdAt,
      active: ACTIVE_JOB_STATUSES.includes(job.status),
      job,
    }));
    // A problem accepted since problems became trips is already listed as its trip (job).
    const fromProblems: HistoryEntry[] = (problems.data ?? [])
      .filter((problem) => !problem.bookingRequestId)
      .map((problem) => ({
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
        showToast({
          variant: 'success',
          title: t('bookings.acceptedToastTitle'),
          message: t('bookings.acceptedToastMessage'),
        });
        Notifications.dismissNotificationAsync(offer.bookingRequestId).catch(() => {});
        jobs.refetch();
        openJob(offer.bookingRequestId);
      },
      onError: (err) => {
        const alreadyTaken = err instanceof ApiError && err.code === 'BOOKING_ALREADY_TAKEN';
        showToast({
          variant: alreadyTaken ? 'info' : 'error',
          title: t(alreadyTaken ? 'bookings.takenToastTitle' : 'common.errorTitle'),
          message: alreadyTaken ? t('bookings.takenToastMessage') : getLocalizedErrorMessage(err, t),
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
      onError: () =>
        showToast({
          variant: 'error',
          title: t('common.errorTitle'),
          message: t('errors.generic'),
        }),
    });
  };

  const renderOffer = ({ item }: { item: PendingOffer }) => {
    const accepting = acceptMutation.isPending && acceptMutation.variables === item.bookingRequestId;
    const declining = declineMutation.isPending && declineMutation.variables === item.bookingRequestId;
    const busy = accepting || declining;
    return (
      <View
        style={[
          styles.card,
          styles.thickBorder,
          {
            backgroundColor: `${brandColors.success}0D`,
            borderColor: `${brandColors.success}80`,
          },
        ]}
      >
        <View style={styles.offerTop}>
          <View style={[styles.offerAvatar, { backgroundColor: `${colors.primary}1A` }]}>
            <FontAwesome6 name="user" size={16} color={colors.primary} solid />
          </View>
          <View style={styles.entryBody}>
            <Text style={[styles.offerName, { color: colors.text }]} numberOfLines={1}>
              {item.customerFullName}
            </Text>
            {item.direct ? (
              <View style={[styles.directTag, { backgroundColor: `${colors.primary}14` }]}>
                <FontAwesome6 name="user-check" size={10} color={colors.primary} solid />
                <Text style={[styles.directTagText, { color: colors.primary }]}>{t('bookings.directTag')}</Text>
              </View>
            ) : null}
            {item.locationAddress ? (
              <Text style={[styles.entryMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {placeName(item.locationAddress)}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.distancePill, { backgroundColor: `${colors.primary}16` }]}>
            <FontAwesome6 name="location-dot" size={12} color={colors.primary} solid />
            <Text style={[styles.distanceText, { color: colors.primary }]}>
              {t('bookings.distanceAway', {
                distance: formatDistance(item.distanceMeters),
              })}
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
              {
                borderColor: colors.border,
                opacity: accepting ? 0.35 : pressed || declining ? 0.8 : 1,
              },
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
              {
                backgroundColor: brandColors.success,
                opacity: pressed || accepting ? 0.8 : 1,
              },
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
  };

  const statusColor = (status: string): string => {
    if (status === 'completed') return brandColors.success;
    if (status === 'cancelled') return brandColors.error;
    if (status === 'work_done') return brandColors.warning;
    return colors.primary;
  };

  const renderEntry = (item: HistoryEntry) => {
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
        style={[
          styles.card,
          styles.entryCard,
          // Under way: red (waiting on you); done: a grey, quieter card. A problem job has its own
          // purple icon.
          item.active
            ? {
                backgroundColor: `${brandColors.error}0A`,
                borderColor: `${brandColors.error}80`,
              }
            : {
                backgroundColor: `${colors.textMuted}0F`,
                borderColor: colors.border,
              },
          styles.thickBorder,
        ]}
        onPress={() => (isJob ? openJob(item.job.id) : navigation.navigate('Home'))}
      >
        <View style={[styles.entryIcon, { backgroundColor: `${accent}1A` }]}>
          <FontAwesome6 name={isProblem ? 'clipboard-list' : 'bolt'} size={16} color={accent} solid />
        </View>
        <View style={styles.entryBody}>
          <View style={styles.entryTitleRow}>
            <Text style={[styles.entryTitle, { color: colors.text }]} numberOfLines={1}>
              {customer}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: `${tone}1A` }]}>
              <Text style={[styles.statusText, { color: tone }]} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text style={[styles.entryMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {skills} · {formatDate(item.createdAt)}
            {amount != null ? ` · ₹${amount.toLocaleString('en-IN')}` : ''}
          </Text>
          <Text style={[styles.entryType, { color: accent }]} numberOfLines={1}>
            {t(isProblem ? 'bookings.typeProblem' : 'bookings.typeQuickBook')}
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

  // The partner's sides — only the ones they have; a switch only when there's more than one.
  const sides: Side[] = [...(isWorker ? (['services'] as const) : []), ...(isShop ? (['shop'] as const) : []), ...(jobPost.data ? (['job'] as const) : [])];
  const side: Side = pickedSide && sides.includes(pickedSide) ? pickedSide : (sides[0] ?? 'job');

  // Services: requests first, then work under way, then finished and cancelled, newest first.
  const jobStatus = (entry: HistoryEntry) => (entry.kind === 'job' ? entry.job.status : entry.problem.status);
  const isCancelled = (entry: HistoryEntry) => jobStatus(entry) === 'cancelled';
  const offerRows: Row[] = (offers ?? [])
    .filter((offer) => inRange(offer.createdAt, range))
    .map((offer) => ({ kind: 'offer', key: `o-${offer.offerId}`, offer }));
  const entryRows = (list: HistoryEntry[]): Row[] =>
    list
      .filter((entry) => inRange(entry.createdAt, range))
      .map((entry) => ({
        kind: 'entry',
        key: `${entry.kind}-${entry.id}`,
        entry,
      }));
  const doneEntries = historyEntries.filter((entry) => !isCancelled(entry));
  const cancelledEntries = historyEntries.filter(isCancelled);
  const jobRows: Record<JobFilter, Row[]> = {
    all: [...entryRows(activeEntries), ...entryRows(historyEntries)],
    active: entryRows(activeEntries),
    done: entryRows(doneEntries),
    cancelled: entryRows(cancelledEntries),
  };
  const jobOptions = [
    {
      key: 'all' as const,
      label: t('activity.filterAll'),
      icon: 'layer-group' as const,
      count: jobRows.all.length,
    },
    {
      key: 'active' as const,
      label: t('activity.filterActive'),
      icon: 'person-digging' as const,
      count: jobRows.active.length,
    },
    {
      key: 'done' as const,
      label: t('activity.filterDone'),
      icon: 'circle-check' as const,
      count: jobRows.done.length,
    },
    {
      key: 'cancelled' as const,
      label: t('activity.filterCancelled'),
      icon: 'ban' as const,
      count: jobRows.cancelled.length,
    },
  ];
  // New orders not answered yet aren't activity (they're in New for you).
  const shopAll = (shopOrders.data ?? []).filter((order) => order.status !== 'placed' && inRange(order.createdAt, range));
  const shopCounts = {
    all: shopAll.length,
    active: shopAll.filter((order) => ['accepted', 'preparing', 'packed', 'ready_for_pickup', 'out_for_delivery'].includes(order.status)).length,
    done: shopAll.filter((order) => order.status === 'completed').length,
    cancelled: shopAll.filter((order) => ['cancelled', 'declined', 'expired'].includes(order.status)).length,
  };
  const shopOptions = [
    {
      key: 'all' as const,
      label: t('activity.filterAll'),
      icon: 'layer-group' as const,
      count: shopCounts.all,
    },
    {
      key: 'active' as const,
      label: t('activity.filterActive'),
      icon: 'basket-shopping' as const,
      count: shopCounts.active,
    },
    {
      key: 'done' as const,
      label: t('activity.filterDone'),
      icon: 'circle-check' as const,
      count: shopCounts.done,
    },
    {
      key: 'cancelled' as const,
      label: t('activity.filterCancelled'),
      icon: 'ban' as const,
      count: shopCounts.cancelled,
    },
  ];

  const loading = offersLoading || jobs.isLoading;
  const periodText = rangeLabel(range, t) ?? t('activity.allTime');

  // Services: how many jobs were finished, how many requests came and how many were taken —
  // no money here (prices aren't confirmed by anyone, so a total could be made up).
  const offerStats = useOfferStats(range.from, range.to, isWorker);
  const servicesSummary = (
    <ActivitySummary
      icon="circle-check"
      label={t('activity.jobsDoneLabel', { period: periodText })}
      value={String(jobRows.done.length)}
      gradient={headerGradient}
      stats={[
        {
          icon: 'bell',
          value: offerStats.data?.received ?? 0,
          label: t('activity.offersReceived'),
        },
        {
          icon: 'handshake',
          value: offerStats.data?.accepted ?? 0,
          label: t('activity.offersAccepted'),
        },
        {
          icon: 'person-digging',
          value: jobRows.active.length,
          label: t('activity.filterActive'),
        },
      ]}
    />
  );
  // Shop: the bills of orders completed in these dates.
  const shopCompleted = (shopOrders.data ?? []).filter((order) => order.status === 'completed' && inRange(order.completedAt, range));
  const shopSummary = (
    <ActivitySummary
      icon="indian-rupee-sign"
      label={t('activity.earned', { period: periodText })}
      value={formatRupees(shopCompleted.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0))}
      gradient={headerGradient}
      stats={[
        {
          icon: 'circle-check',
          value: shopCounts.done,
          label: t('activity.filterDone'),
        },
        {
          icon: 'basket-shopping',
          value: shopCounts.active,
          label: t('activity.filterActive'),
        },
        {
          icon: 'ban',
          value: shopCounts.cancelled,
          label: t('activity.filterCancelled'),
        },
      ]}
    />
  );

  // No switch (one side only): pull the content up, so the filter isn't far below the header.
  const tight = sides.length < 2 ? styles.tight : null;
  const sideSwitch =
    sides.length > 1 ? (
      <View style={[styles.modeSwitch, { borderColor: colors.border }]}>
        {sides.map((value) => {
          const active = side === value;
          return (
            <Pressable key={value} onPress={() => setPickedSide(value)} style={[styles.modeOption, active ? { backgroundColor: colors.primary } : null]}>
              <FontAwesome6 name={SIDE_ICONS[value]} size={12} color={active ? '#FFFFFF' : colors.textMuted} solid />
              <Text style={[styles.modeText, { color: active ? '#FFFFFF' : colors.textMuted }]} numberOfLines={1}>
                {t(`homeSides.${value === 'services' ? 'services' : value === 'shop' ? 'shop' : 'jobPost'}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ) : null;

  if (side === 'shop') {
    return (
      <ScreenContainer edges={['left', 'right']}>
        {sideSwitch}
        {/* The filter and the summary scroll away with the orders, leaving the list room. */}
        <View style={[styles.flexFill, tight]}>
          <ShopOrdersList
            key={`shop-${visit}`}
            filter={shopFilter}
            range={range}
            header={
              <>
                <ActivityFilter value={shopFilter} options={shopOptions} onChange={setShopFilter} range={range} onRangeChange={setRange} />
                {shopSummary}
              </>
            }
          />
        </View>
      </ScreenContainer>
    );
  }

  if (side === 'job') {
    return (
      <ScreenContainer edges={['left', 'right']}>
        {sideSwitch}
        <View style={[styles.flexFill, tight]}>
          <JobPostActivity />
        </View>
      </ScreenContainer>
    );
  }

  const rows = jobRows[jobFilter];
  return (
    <ScreenContainer edges={['left', 'right']}>
      {sideSwitch}

      <View style={[styles.flexFill, tight]}>
        {loading ? (
          <View style={styles.centerWrap}>
            <LoadingIndicator color={colors.primary} />
          </View>
        ) : rows.length === 0 ? (
          // Nothing to list: no pull-to-refresh room (on a short list it could show as a gap).
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
            <ActivityFilter value={jobFilter} options={jobOptions} onChange={setJobFilter} range={range} onRangeChange={setRange} />
            {servicesSummary}
            <LocationNeededCard />
            {jobFilter === 'active'
              ? renderEmpty('person-digging', t('bookings.emptyActiveTitle'), t('bookings.emptyActiveMessage'))
              : renderEmpty('clock-rotate-left', t('activity.emptyTitle'), t('activity.emptyMessage'))}
          </ScrollView>
        ) : (
          // Each filter gets its own list, placed fresh (never opening on the refresh gap).
          <PullToRefresh key={`${visit}-${jobFilter}-${range.from?.getTime() ?? 0}-${range.to?.getTime() ?? 0}`} refreshing={refreshing} onRefresh={onRefresh}>
            <FlatList
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              data={rows}
              keyExtractor={(row) => row.key}
              contentContainerStyle={styles.listContent}
              // The summary and the filter scroll away with the list, leaving it room.
              ListHeaderComponent={
                <>
                  <ActivityFilter value={jobFilter} options={jobOptions} onChange={setJobFilter} range={range} onRangeChange={setRange} />
                  {servicesSummary}
                  <LocationNeededCard />
                </>
              }
              renderItem={({ item: row }) => (row.kind === 'offer' ? renderOffer({ item: row.offer }) : renderEntry(row.entry))}
              ListEmptyComponent={
                jobFilter === 'active'
                  ? renderEmpty('person-digging', t('bookings.emptyActiveTitle'), t('bookings.emptyActiveMessage'))
                  : renderEmpty('clock-rotate-left', t('activity.emptyTitle'), t('activity.emptyMessage'))
              }
            />
          </PullToRefresh>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  thickBorder: { borderWidth: 2 },
  directTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginVertical: 3,
  },
  directTagText: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  modeSwitch: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 3,
    marginBottom: 14,
    gap: 4,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 11,
  },
  modeText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  modeDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  segment: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 10,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  segmentText: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#FFFFFF', fontSize: 10, fontFamily: fonts.semiBold },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  emptyTitle: {
    ...typography.subheading,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
  },
  emptyMessage: { ...typography.body, textAlign: 'center', lineHeight: 20 },
  // Extra bottom padding clears the floating CustomTabBar.
  listContent: { paddingBottom: 120, flexGrow: 1 },
  flexFill: { flex: 1 },
  tight: { marginTop: -8 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row' },
  offerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  offerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerName: { ...typography.subheading, fontFamily: fonts.semiBold },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  distanceText: {
    ...typography.body,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
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
  acceptButtonText: {
    ...typography.body,
    fontFamily: fonts.semiBold,
    color: '#FFFFFF',
  },
  entryCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  entryIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryBody: { flex: 1, gap: 3 },
  entryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryTitle: { ...typography.body, fontFamily: fonts.semiBold, flex: 1 },
  statusPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '50%',
  },
  statusText: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    fontSize: 10,
  },
  entryMeta: { ...typography.caption, fontSize: 12 },
  entryType: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  reviewText: { flex: 1, marginLeft: 6, fontStyle: 'italic' },
});
