import React, { useState } from 'react';
import { placeName } from '@/utils/formatAddress';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { ProblemDetailModal } from '@/components/ProblemDetailModal';
import { JobPostHomeSection } from '@/components/JobPostHomeSection';
import { useMyJobPost } from '@/hooks/useJobPost';
import { ContinueSteps } from '@/components/ContinueSteps';
import { askForLocation } from '@/utils/ensureLocationOn';
import { useAdGate, useBusyAction } from '@/components/Ads';
import { LocationNeededCard } from '@/components/LocationNeededCard';
import { BackgroundAlertsCard } from '@/components/BackgroundAlertsCard';
import { FindJobsButton } from '@/components/FindJobsButton';
import { navigateToBookings } from '@/navigation/navigationRef';
import { useQueryClient } from '@tanstack/react-query';
import { openJob } from '@/state/jobFocusStore';
import { jobQueryKey, useMyJobs } from '@/hooks/useJobs';
import { openShopOrder } from '@/state/shopOrderFocusStore';
import { ACTIVE_JOB_STATUSES } from '@/services/jobsService';
import { StackStep, StepStack } from '@/components/StepStack';
import { HomeLocationBar } from '@/components/HomeLocationBar';
import { ACTIVE_SHOP_STATUSES, formatRupees } from '@/services/shopOrdersService';
import { jobsService } from '@/services/jobsService';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/state/authStore';
import { showToast } from '@/state/toastStore';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { useShopOrders } from '@/hooks/useShopOrders';
import { useAcceptProblem, useAssignedProblems, useMarkWorkDone, useNearbyProblems } from '@/hooks/useProblems';
import { AssignedProblem, NearbyProblem } from '@/services/problemsService';
import { ApiError } from '@/services/apiClient';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { formatDistance } from '@/utils/formatDistance';
import { PullToRefresh } from '@/components/PullToRefresh';
import { NewForYou } from '@/components/NewForYou';
import { FindOrdersButton } from '@/components/FindOrdersButton';
import { useAttentionCounts } from '@/hooks/useAttentionCounts';
import { SmartImage } from '@/components/SmartImage';

const DONE_GRADIENT = ['#16A34A', '#22C55E'] as const;
const RECENT_LIMIT = 5;
// Lets the job screen finish fading in on top before the detail screen closes underneath it.
const MODAL_HANDOFF_MS = 350;

/**
 * Worker Home — the receiving side of user-app's "Your Problems":
 *  - My Jobs: problems this worker accepted that aren't finished yet, with the customer's
 *    name + a call button, and "Mark Work Done" (the customer then confirms it finished).
 *  - Problems Near You: open problems within range that need one of this worker's skills;
 *    first to accept wins (409 PROBLEM_ALREADY_TAKEN otherwise).
 *  - Finished Jobs: the last few the customer confirmed.
 * Only for a verified Worker capability — a Business-only partner sees an explanation.
 */
type HomeSide = 'shop' | 'worker' | 'job';
const SIDE_ICONS = { shop: 'store', worker: 'screwdriver-wrench', job: 'user-tie' } as const;
const SIDE_LABELS = { shop: 'homeSides.shop', worker: 'homeSides.services', job: 'homeSides.jobPost' } as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function HomeScreen() {
  const { t } = useTranslation();
  // Mark Work Done: location, then a local business's ad while that job's button spins.
  const { adLoading, waitForAd } = useAdGate(true, 'work_done');
  const { run: runWorkDone } = useBusyAction();
  const [adForJob, setAdForJob] = useState<string | null>(null);
  const { colors } = useThemeColors();
  const account = useAuthStore((state) => state.account);
  const workerProfile = useMyWorkerProfile();
  const isVerifiedWorker = workerProfile.data?.verificationStatus === 'verified';
  const businessProfile = useMyBusinessProfile();
  const isVerifiedShop = businessProfile.data?.verificationStatus === 'verified';
  const shopOrders = useShopOrders(isVerifiedShop);
  const newOrderCount = (shopOrders.data ?? []).filter((order) => order.status === 'placed').length;
  // Home switches between the partner's sides: their shop, their services (worker jobs) and
  // their "looking for work" post. Until they pick, it shows the shop when an order is waiting,
  // otherwise their worker jobs, otherwise the shop.
  const [pickedSide, setPickedSide] = useState<HomeSide | null>(null);
  // Only what the partner has made: a verified shop, verified services, a job post. Adding
  // or editing any of them lives in the menu (SettingsMenuModal → My Profiles).
  const jobPost = useMyJobPost();
  const hasJobPost = !!jobPost.data;
  // All three answers together, so the switch never shows two sides and then a third.
  const profilesLoading = workerProfile.isLoading || businessProfile.isLoading || jobPost.isLoading;
  const ownSides: HomeSide[] = [
    ...(isVerifiedShop ? ['shop' as const] : []),
    ...(isVerifiedWorker ? ['worker' as const] : []),
    ...(hasJobPost ? ['job' as const] : []),
  ];
  const sides: HomeSide[] = ownSides.length > 0 ? ownSides : ['job'];
  const defaultSide: HomeSide =
    isVerifiedShop && (newOrderCount > 0 || !isVerifiedWorker) ? 'shop' : isVerifiedWorker ? 'worker' : 'job';
  const side: HomeSide = pickedSide && sides.includes(pickedSide) ? pickedSide : defaultSide;
  // A red dot on a side with something new or under way.
  const attention = useAttentionCounts();
  const sideWaiting = (value: HomeSide) =>
    value === 'shop' ? attention.orders > 0 : value === 'worker' ? attention.jobs > 0 : attention.jobPostViews > 0;
  const nearby = useNearbyProblems(isVerifiedWorker);
  const assigned = useAssignedProblems(isVerifiedWorker);
  const acceptProblem = useAcceptProblem();
  const markWorkDone = useMarkWorkDone();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [confirmDoneFor, setConfirmDoneFor] = useState<AssignedProblem | null>(null);
  const [detailProblem, setDetailProblem] = useState<NearbyProblem | null>(null);
  const queryClient = useQueryClient();

  const skillLabel = (keys: string[]) => keys.map((key) => t(`workerProfile.skills.${key}`)).join(', ');
  const activeJobs = (assigned.data ?? []).filter((job) => job.status !== 'completed' && !job.bookingRequestId);
  // The last five jobs and orders (any step), newest first.
  const myJobs = useMyJobs();
  const recentJobs = [...(myJobs.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT_LIMIT);
  const recentOrders = [...(shopOrders.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT_LIMIT);

  const handleAccept = (problem: NearbyProblem) => {
    setAcceptingId(problem.id);
    acceptProblem.mutate(problem.id, {
      onSuccess: async (accepted) => {
        showToast({ variant: 'success', title: t('problems.acceptedTitle'), message: t('problems.acceptedMessage') });
        const tripId = accepted.bookingRequestId;
        if (!tripId) {
          setDetailProblem(null);
          return;
        }
        // Straight into the job screen (map, customer, Start Trip): load it first so it
        // opens filled in, open it on top, then close the detail screen underneath.
        await queryClient
          .prefetchQuery({ queryKey: jobQueryKey(tripId), queryFn: () => jobsService.get(tripId) })
          .catch(() => {});
        openJob(tripId);
        setTimeout(() => setDetailProblem(null), MODAL_HANDOFF_MS);
      },
      onError: (err) => {
        const alreadyTaken = err instanceof ApiError && err.code === 'PROBLEM_ALREADY_TAKEN';
        showToast(
          alreadyTaken
            ? { variant: 'info', title: t('problems.takenTitle'), message: t('problems.takenMessage') }
            : { variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(err, t) },
        );
      },
      onSettled: () => setAcceptingId(null),
    });
  };

  const handleConfirmDone = () => {
    if (!confirmDoneFor) return;
    markWorkDone.mutate(confirmDoneFor.id, {
      onSuccess: () =>
        showToast({ variant: 'success', title: t('problems.workDoneTitle'), message: t('problems.workDoneMessage') }),
      onError: (err) => showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(err, t) }),
      onSettled: () => setConfirmDoneFor(null),
    });
  };

  const callCustomer = (mobileNumber: string) => {
    Linking.openURL(`tel:${mobileNumber}`).catch(() => {});
  };

  const renderPhotos = (photoUrls: string[], onPress?: () => void) =>
    photoUrls.length > 0 ? (
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        horizontal
        contentContainerStyle={styles.photoRow}
      >
        {photoUrls.map((url) => (
          <Pressable key={url} onPress={onPress} disabled={!onPress}>
            <SmartImage source={{ uri: url }} style={styles.photo} />
          </Pressable>
        ))}
      </ScrollView>
    ) : null;

  const renderMeta = (icon: React.ComponentProps<typeof FontAwesome6>['name'], text: string | null) =>
    text ? (
      <View style={styles.metaRow}>
        <FontAwesome6 name={icon} size={12} color={colors.textMuted} solid />
        <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={2}>
          {text}
        </Text>
      </View>
    ) : null;

  const renderStatusPill = (label: string, color: string) => (
    <View style={[styles.pill, { backgroundColor: `${color}1A` }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );

  const renderActiveJob = (job: AssignedProblem) => {
    const tripId = job.bookingRequestId;
    // Jobs accepted since problems became trips are worked from the job screen (map, PIN,
    // work done); older ones keep their original Mark Work Done button below.
    const isWorkDone = tripId ? job.bookingStatus === 'work_done' : job.status === 'work_done';
    const statusLabel =
      tripId && job.bookingStatus ? t(`job.status.${job.bookingStatus}.title`) : t(`problems.status.${job.status}`);
    return (
      <Pressable
        key={job.id}
        disabled={!tripId}
        onPress={() => tripId && openJob(tripId)}
        style={[styles.card, { backgroundColor: `${brandColors.pending}0A`, borderColor: `${brandColors.pending}99` }]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {job.customerFullName}
          </Text>
          {renderStatusPill(statusLabel, isWorkDone ? brandColors.warning : brandColors.success)}
        </View>
        <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
          {skillLabel(job.skillCategories)}
        </Text>
        <Text style={[styles.quotation, { color: colors.primary }]}>₹{job.quotationAmount.toLocaleString('en-IN')}</Text>

        <View style={[styles.customerRow, { backgroundColor: `${colors.primary}0F` }]}>
          <View style={styles.customerInfo}>
            <Text style={[styles.customerLabel, { color: colors.textMuted }]}>{t('problems.customer')}</Text>
            <Text style={[styles.customerName, { color: colors.text }]}>{job.customerFullName}</Text>
            <Text style={[styles.customerPhone, { color: colors.textMuted }]}>{job.customerMobileNumber}</Text>
          </View>
          <Pressable
            style={[styles.callButton, { backgroundColor: brandColors.success }]}
            onPress={() => callCustomer(job.customerMobileNumber)}
            accessibilityLabel={t('problems.callCustomer')}
          >
            <FontAwesome6 name="phone" size={16} color="#FFFFFF" solid />
          </Pressable>
        </View>

        {renderMeta('location-dot', placeName(job.locationAddress))}
        {job.description ? <Text style={[styles.description, { color: colors.text }]}>{job.description}</Text> : null}
        {renderPhotos(job.photoUrls)}

        <View style={styles.cardAction}>
          {tripId ? (
            <Button label={t('problemDetail.openJob')} onPress={() => openJob(tripId)} />
          ) : isWorkDone ? (
            <Text style={[styles.waitingText, { color: colors.textMuted }]}>{t('problems.waitingForCustomer')}</Text>
          ) : (
            <Button
              label={t('problems.markWorkDone')}
              onPress={() =>
                runWorkDone(async () => {
                  if (adLoading) return;
                  // Spins from the tap (the location check can take a moment) until the ad is done.
                  setAdForJob(job.id);
                  try {
                    if (!(await askForLocation())) return;
                    if (await waitForAd()) setConfirmDoneFor(job);
                  } finally {
                    setAdForJob(null);
                  }
                })
              }
              loading={adForJob === job.id}
              gradient={DONE_GRADIENT}
            />
          )}
        </View>
      </Pressable>
    );
  };

  const renderNearbyProblem = (problem: NearbyProblem) => (
    <Pressable
      key={problem.id}
      onPress={() => setDetailProblem(problem)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
          {skillLabel(problem.skillCategories)}
        </Text>
        <View style={[styles.distancePill, { backgroundColor: `${colors.primary}16` }]}>
          <FontAwesome6 name="location-arrow" size={11} color={colors.primary} solid />
          <Text style={[styles.distanceText, { color: colors.primary }]}>
            {t('problems.distanceAway', { distance: formatDistance(problem.distanceMeters) })}
          </Text>
        </View>
      </View>
      <Text style={[styles.quotation, { color: colors.primary }]}>₹{problem.quotationAmount.toLocaleString('en-IN')}</Text>
      {renderMeta('location-dot', placeName(problem.locationAddress))}
      {problem.description ? (
        <Text style={[styles.description, { color: colors.text }]} numberOfLines={2}>
          {problem.description}
        </Text>
      ) : null}
      {renderPhotos(problem.photoUrls, () => setDetailProblem(problem))}
      <View style={styles.viewDetails}>
        <Text style={[styles.viewDetailsText, { color: colors.primary }]}>{t('problemDetail.viewDetails')}</Text>
        <FontAwesome6 name="chevron-right" size={11} color={colors.primary} solid />
      </View>
      <View style={styles.cardAction}>
        <Button
          label={t('problems.accept')}
          onPress={() => handleAccept(problem)}
          loading={acceptingId === problem.id}
          disabled={acceptingId !== null && acceptingId !== problem.id}
        />
      </View>
    </Pressable>
  );

  const stepTone = (status: string, active: boolean) =>
    active ? brandColors.error : status === 'completed' ? brandColors.success : colors.textMuted;

  // The last few jobs and orders, stacked like notifications — the newest in front.
  const recentJobSteps: StackStep[] = recentJobs.map((job) => ({
    key: job.id,
    icon: job.problemPostId ? 'clipboard-list' : 'bolt',
    name: job.customerFullName,
    stepTitle: skillLabel(job.skillCategories),
    hint: formatShortDate(job.createdAt),
    action: t('home.open'),
    tag: { label: t(`job.status.${job.status}.title`), color: stepTone(job.status, ACTIVE_JOB_STATUSES.includes(job.status)) },
    onPress: () => openJob(job.id),
  }));
  const recentOrderSteps: StackStep[] = recentOrders.map((order) => ({
    key: order.id,
    icon: order.fulfillment === 'delivery' ? 'truck' : 'basket-shopping',
    name: order.customerFullName,
    stepTitle: [t('shopOrders.itemsCount', { count: order.items.length }), order.totalAmount != null ? formatRupees(order.totalAmount) : null]
      .filter(Boolean)
      .join(' · '),
    hint: formatShortDate(order.createdAt),
    action: t('home.open'),
    tag: {
      label: t(`shopOrders.status.${order.status}.title`),
      color: order.status === 'placed' ? brandColors.success : stepTone(order.status, ACTIVE_SHOP_STATUSES.includes(order.status)),
    },
    onPress: () => openShopOrder(order.id),
  }));

  // "All bookings" / "All shop orders": a bright card leading to Activity.
  const renderAllButton = (icon: React.ComponentProps<typeof FontAwesome6>['name'], title: string, hint: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.allWrap, { transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.allCard}>
        <View style={styles.allIcon}>
          <FontAwesome6 name={icon} size={15} color="#FFFFFF" solid />
        </View>
        <View style={styles.flex}>
          <Text style={styles.allTitle}>{title}</Text>
          <Text style={styles.allHint} numberOfLines={1}>
            {hint}
          </Text>
        </View>
        <View style={styles.allGo}>
          <FontAwesome6 name="arrow-right" size={12} color={headerGradient[0]} solid />
        </View>
      </LinearGradient>
    </Pressable>
  );

  const renderSectionTitle = (icon: React.ComponentProps<typeof FontAwesome6>['name'], title: string, count?: number, tone?: string) => (
    <View style={styles.sectionRow}>
      <LinearGradient colors={tone ? [tone, `${tone}B3`] : headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sectionIcon}>
        <FontAwesome6 name={icon} size={12} color="#FFFFFF" solid />
      </LinearGradient>
      <Text style={[styles.sectionRowTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      {count !== undefined ? (
        <View style={[styles.sectionCount, { backgroundColor: `${tone ?? colors.primary}18` }]}>
          <Text style={[styles.sectionCountText, { color: tone ?? colors.primary }]}>{count}</Text>
        </View>
      ) : null}
      <View style={[styles.sectionRule, { backgroundColor: `${colors.primary}1F` }]} />
    </View>
  );

  const renderEmpty = (icon: React.ComponentProps<typeof FontAwesome6>['name'], title: string, message: string) => (
    <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <FontAwesome6 name={icon} size={22} color={colors.textMuted} solid />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{message}</Text>
    </View>
  );

  const renderWorkerBody = () => {
    if (nearby.isLoading || assigned.isLoading) {
      return (
        <View style={styles.loading}>
          <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
        </View>
      );
    }
    if (nearby.isError || assigned.isError) {
      return (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('problems.loadFailedTitle')}</Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>
            {getLocalizedErrorMessage(nearby.error ?? assigned.error, t)}
          </Text>
          <View style={styles.retryWrap}>
            <Button
              label={t('common.retry')}
              onPress={() => {
                nearby.refetch();
                assigned.refetch();
              }}
            />
          </View>
        </View>
      );
    }

    return (
      <>
        {renderSectionTitle('magnifying-glass-location', t('findJobs.sectionTitle'))}
        <FindJobsButton variant="card" onFound={() => navigateToBookings('jobs', 'requests')} />

        {activeJobs.length > 0 ? (
          <>
            {renderSectionTitle('person-digging', t('problems.myJobsTitle'), activeJobs.length)}
            {activeJobs.map(renderActiveJob)}
          </>
        ) : null}

        {renderSectionTitle('clipboard-list', t('problems.nearbyTitle'), (nearby.data ?? []).length)}
        {workerProfile.data?.latitude == null
          ? renderEmpty('location-crosshairs', t('problems.noLocationTitle'), t('problems.noLocationMessage'))
          : (nearby.data ?? []).length === 0
            ? renderEmpty('clipboard-list', t('problems.noneNearbyTitle'), t('problems.noneNearbyMessage'))
            : (nearby.data ?? []).map(renderNearbyProblem)}

        {recentJobs.length > 0 ? (
          <>
            <StepStack title={t('home.recentJobs')} steps={recentJobSteps} minimized live={false} hideMore accent={colors.primary} style={styles.recentStack} />
            {renderAllButton('calendar-check', t('problems.allBookings'), t('home.allBookingsHint'), () => navigateToBookings('jobs'))}
          </>
        ) : null}
      </>
    );
  };

  const refreshing = nearby.isRefetching || assigned.isRefetching || workerProfile.isRefetching || shopOrders.isRefetching;
  const onRefresh = () => {
    workerProfile.refetch();
    businessProfile.refetch();
    if (isVerifiedShop) shopOrders.refetch();
    if (isVerifiedWorker) {
      nearby.refetch();
      assigned.refetch();
    }
  };

  return (
    <ScreenContainer edges={['left', 'right']}>
      <PullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.body}
        >
          {/* Which side you're looking at comes first, above the greeting. */}
          {!profilesLoading ? (
            <View style={[styles.sideSwitch, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              {sides.map((value) => {
                const active = side === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setPickedSide(value)}
                    style={[styles.sideOption, active ? { backgroundColor: colors.primary } : null]}
                  >
                    <FontAwesome6 name={SIDE_ICONS[value]} size={12} color={active ? '#FFFFFF' : colors.textMuted} solid />
                    <Text
                      style={[styles.sideText, { color: active ? '#FFFFFF' : colors.textMuted }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {t(SIDE_LABELS[value])}
                    </Text>
                    {sideWaiting(value) ? (
                      <View style={[styles.sideDot, { backgroundColor: brandColors.error, borderColor: active ? '#FFFFFF' : colors.surface }]} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {account ? (
            <Text style={[styles.greeting, styles.greetingTight, { color: colors.text }]}>
              {t('mainTabs.Home.greeting', { name: account.fullName })}
            </Text>
          ) : null}
          <HomeLocationBar />

          {/* Location off: say so first — nothing works without it. */}
          <LocationNeededCard />
          {/* Job requests while the app is closed: the phone has to allow it. */}
          <BackgroundAlertsCard />


          {profilesLoading ? (
            <View style={styles.loading}>
              <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
            </View>
          ) : null}


          {profilesLoading ? null : side === 'job' ? (
            <JobPostHomeSection />
          ) : side === 'shop' && isVerifiedShop && businessProfile.data ? (
            <>
              <NewForYou isWorker={false} isShop />
              <ContinueSteps isShop only="orders" />
              {renderSectionTitle('magnifying-glass-location', t('findOrders.sectionTitle'))}
              <FindOrdersButton />
              {recentOrders.length > 0 ? (
                <>
                  <StepStack title={t('home.recentOrders')} steps={recentOrderSteps} minimized live={false} hideMore accent={colors.primary} style={styles.recentStack} />
                </>
              ) : (
                renderEmpty('bell', t('shopHome.noOrdersTitle'), t('shopHome.noOrdersMessage'))
              )}
              {renderAllButton('receipt', t('shopHome.allOrders'), t('home.allOrdersHint'), () => navigateToBookings('orders'))}
            </>
          ) : isVerifiedWorker ? (
            <>
              <NewForYou isWorker isShop={false} />
              <ContinueSteps isShop={false} only="jobs" />
              {renderWorkerBody()}
            </>
          ) : (
            renderEmpty('screwdriver-wrench', t('problems.workersOnlyTitle'), t('problems.workersOnlyMessage'))
          )}
        </ScrollView>
      </PullToRefresh>

      <ProblemDetailModal
        problem={detailProblem}
        onClose={() => setDetailProblem(null)}
        onAccept={detailProblem ? () => handleAccept(detailProblem) : undefined}
        accepting={detailProblem !== null && acceptingId === detailProblem.id}
      />

      <ConfirmModal
        visible={confirmDoneFor !== null}
        icon="circle-check"
        gradient={DONE_GRADIENT}
        title={t('problems.confirmDoneTitle')}
        message={t('problems.confirmDoneMessage')}
        confirmLabel={t('problems.markWorkDone')}
        loading={markWorkDone.isPending}
        onConfirm={handleConfirmDone}
        onCancel={() => setConfirmDoneFor(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Extra bottom padding clears the floating CustomTabBar.
  body: { paddingBottom: 120 },
  greeting: { ...typography.heading, fontFamily: fonts.semiBold, fontSize: 19, marginBottom: 10 },
  sideSwitch: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 3, marginBottom: 18, gap: 4 },
  sideOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  sideText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
  sideDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  allOrders: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    height: 46,
    marginTop: 14,
  },
  allOrdersText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  sideBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  sideBadgeText: { fontSize: 10, fontFamily: fonts.semiBold },
  // Same spacing for every section title in this app: 22 above, 12 below.
  sectionTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginTop: 22, marginBottom: 12 },
  loading: { paddingVertical: 48, alignItems: 'center' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { ...typography.body, fontFamily: fonts.semiBold, flex: 1 },
  quotation: { ...typography.heading, fontFamily: fonts.semiBold, fontSize: 22, marginTop: 6 },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  distanceText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 11 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  metaText: { ...typography.caption, flex: 1 },
  description: { ...typography.body, fontSize: 13, marginTop: 8, lineHeight: 19 },
  photoRow: { gap: 8, marginTop: 12 },
  photo: { width: 84, height: 84, borderRadius: 10 },
  cardAction: { marginTop: 14 },
  viewDetails: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  viewDetailsText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
  customerRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginTop: 10 },
  customerInfo: { flex: 1 },
  customerLabel: { ...typography.caption, fontSize: 11 },
  customerName: { ...typography.body, fontFamily: fonts.semiBold },
  customerPhone: { ...typography.caption },
  callButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  waitingText: { ...typography.body, fontFamily: fonts.medium, textAlign: 'center', paddingVertical: 8 },
  flex: { flex: 1 },
  greetingTight: { marginBottom: 10 },
  allWrap: { borderRadius: 18, overflow: 'hidden', marginTop: 4, marginBottom: 6 },
  allCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  allIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15, color: '#FFFFFF', lineHeight: 20 },
  allHint: { ...typography.caption, fontSize: 12, color: 'rgba(255,255,255,0.86)' },
  allGo: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  recentStack: { marginTop: 18, marginBottom: 8 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, padding: 10, marginBottom: 8 },
  recentIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  recentTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recentTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, flexShrink: 1 },
  recentPill: { borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2, maxWidth: '55%' },
  recentPillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10 },
  recentMeta: { ...typography.caption, fontSize: 11.5, marginTop: 1 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, marginBottom: 12 },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionRowTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16, flexShrink: 1 },
  sectionCount: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  sectionCountText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 14 },
  sectionRule: { flex: 1, height: 1, minWidth: 8 },
  finishedRowList: { gap: 10, paddingRight: 4 },
  finishedCard: { width: 200, borderRadius: 18, borderWidth: 1, padding: 12, gap: 4 },
  finishedTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  finishedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, borderRadius: 11, paddingHorizontal: 8 },
  finishedBadgeText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10.5, lineHeight: 14 },
  finishedDate: { ...typography.caption, fontSize: 11 },
  finishedTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  finishedAmount: { fontFamily: fonts.semiBold, fontSize: 20, lineHeight: 26 },
  finishedFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, paddingTop: 8, marginTop: 4 },
  finishedName: { ...typography.caption, fontSize: 12, flex: 1 },
  finishedStars: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  finishedRating: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  emptyCard: { borderRadius: 16, borderWidth: 1, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 8 },
  emptyTitle: { ...typography.body, fontFamily: fonts.semiBold, textAlign: 'center' },
  emptyMessage: { ...typography.caption, textAlign: 'center', lineHeight: 18 },
  retryWrap: { alignSelf: 'stretch', marginTop: 8 },
});
