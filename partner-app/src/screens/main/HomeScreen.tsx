import { PopupPermissionCard } from '@/components/PopupPermissionCard';
import { NewForYou } from '@/components/NewForYou';
import React, { useRef, useState } from 'react';
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
import { HomeAdCarousel, useBusyAction } from '@/components/Ads';
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
import { StaffDeliveriesCard } from '@/components/StaffDeliveriesCard';
import { StaffInvitesCard } from '@/components/StaffInvitesCard';
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
import { FindOrdersButton } from '@/components/FindOrdersButton';
import { useAttentionCounts } from '@/hooks/useAttentionCounts';
import { SmartImage } from '@/components/SmartImage';
import { orderListText } from '@/utils/orderListText';
import { GivenBackError } from '@/utils/afterAccept';
import { FullText } from '@/components/FullText';

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
  // Mark Work Done: location, then confirm (no ad here — ads come after accepting instead).
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
  // Swiping the Live Requests pile: the page holds still (no scroll, no pull-to-refresh).
  // While a finger is on the Live Requests pile the page holds still. Set on the scroll view
  // itself (no page re-render), so it lands before a slight up / down drift can start a scroll
  // or a pull-to-refresh.
  const scrollRef = useRef<ScrollView>(null);
  const lockScroll = (on: boolean) => scrollRef.current?.setNativeProps({ scrollEnabled: !on });
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
  const defaultSide: HomeSide = isVerifiedShop && (newOrderCount > 0 || !isVerifiedWorker) ? 'shop' : isVerifiedWorker ? 'worker' : 'job';
  const side: HomeSide = pickedSide && sides.includes(pickedSide) ? pickedSide : defaultSide;
  // A red dot on a side with something new or under way.
  const attention = useAttentionCounts();
  const sideWaiting = (value: HomeSide) =>
    // Only work under way (Continue where you left off): new requests are in Live Requests above.
    value === 'shop' ? attention.activeOrders > 0 : value === 'worker' ? attention.activeJobs > 0 : attention.jobPostViews > 0;
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
        await queryClient.prefetchQuery({ queryKey: jobQueryKey(tripId), queryFn: () => jobsService.get(tripId), staleTime: 15000 }).catch(() => {});
        openJob(tripId);
        setTimeout(() => setDetailProblem(null), MODAL_HANDOFF_MS);
      },
      onError: (err) => {
        // Backed out of paying after accepting: it was given back (a toast said so).
        if (err instanceof GivenBackError) return;
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
      onSuccess: () => showToast({ variant: 'success', title: t('problems.workDoneTitle'), message: t('problems.workDoneMessage') }),
      onError: (err) => showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(err, t) }),
      onSettled: () => setConfirmDoneFor(null),
    });
  };

  const callCustomer = (mobileNumber: string) => {
    Linking.openURL(`tel:${mobileNumber}`).catch(() => {});
  };

  const renderPhotos = (photoUrls: string[], onPress?: () => void) =>
    photoUrls.length > 0 ? (
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} horizontal contentContainerStyle={styles.photoRow}>
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
        <FullText style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={2}>
          {text}
        </FullText>
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
    const statusLabel = tripId && job.bookingStatus ? t(`job.status.${job.bookingStatus}.title`) : t(`problems.status.${job.status}`);
    return (
      <Pressable
        key={job.id}
        disabled={!tripId}
        onPress={() => tripId && openJob(tripId)}
        style={[styles.card, { backgroundColor: `${brandColors.pending}0A`, borderColor: `${brandColors.pending}99` }]}
      >
        <View style={styles.cardHeader}>
          <FullText style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {job.customerFullName}
          </FullText>
          {renderStatusPill(statusLabel, isWorkDone ? brandColors.warning : brandColors.success)}
        </View>
        <FullText style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
          {skillLabel(job.skillCategories)}
        </FullText>
        <Text style={[styles.quotation, { color: colors.primary }]}>₹{job.quotationAmount.toLocaleString('en-IN')}</Text>

        <View style={[styles.customerRow, { backgroundColor: `${colors.primary}0F` }]}>
          <View style={styles.customerInfo}>
            <Text style={[styles.customerLabel, { color: colors.textMuted }]}>{t('problems.customer')}</Text>
            <Text style={[styles.customerName, { color: colors.text }]}>{job.customerFullName}</Text>
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
                  // Spins from the tap while the location check runs.
                  setAdForJob(job.id);
                  try {
                    if (await askForLocation()) setConfirmDoneFor(job);
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

  // A small card in one sideways row: photo, the work, the price, where and how far, Accept.
  const renderNearbyProblem = (problem: NearbyProblem) => (
    <Pressable
      key={problem.id}
      onPress={() => setDetailProblem(problem)}
      style={({ pressed }) => [
        styles.problemCard,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.problemTop}>
        {problem.photoUrls[0] ? (
          <SmartImage source={{ uri: problem.photoUrls[0] }} style={styles.problemThumb} />
        ) : (
          <LinearGradient colors={PROBLEM_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.problemThumb}>
            <FontAwesome6 name="screwdriver-wrench" size={18} color="#FFFFFF" solid />
          </LinearGradient>
        )}
        <View style={styles.problemInfo}>
          <FullText style={[styles.problemSkill, { color: colors.text }]} numberOfLines={1}>
            {skillLabel(problem.skillCategories)}
          </FullText>
          <Text style={[styles.problemPrice, { color: colors.primary }]}>₹{problem.quotationAmount.toLocaleString('en-IN')}</Text>
        </View>
        <View style={[styles.problemDistance, { backgroundColor: `${colors.primary}14` }]}>
          <FullText style={[styles.problemDistanceText, { color: colors.primary }]} numberOfLines={1}>
            {formatDistance(problem.distanceMeters)}
          </FullText>
        </View>
      </View>
      <View style={styles.problemMetaRow}>
        <FontAwesome6 name="location-dot" size={10} color={colors.textMuted} solid />
        <FullText style={[styles.problemMeta, { color: colors.textMuted }]} numberOfLines={1}>
          {placeName(problem.locationAddress) || t('problems.nearYou')}
        </FullText>
      </View>
      {/* Tap the card for the photos and everything else; Accept right here. */}
      <Pressable
        onPress={() => handleAccept(problem)}
        disabled={acceptingId !== null}
        style={[styles.problemAccept, { backgroundColor: brandColors.success, opacity: acceptingId !== null && acceptingId !== problem.id ? 0.5 : 1 }]}
      >
          {acceptingId === problem.id ? (
            <LoadingIndicator color="#FFFFFF" size={16} dotSize={3} />
          ) : (
            <>
              <FontAwesome6 name="check" size={11} color="#FFFFFF" solid />
              <Text style={styles.problemAcceptText}>{t('problems.accept')}</Text>
            </>
          )}
      </Pressable>
    </Pressable>
  );

  const stepTone = (status: string, active: boolean) => (active ? brandColors.error : status === 'completed' ? brandColors.success : colors.textMuted);

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
    stepTitle: [orderListText(t, order, 'shopOrders.itemsCount'), order.totalAmount != null ? formatRupees(order.totalAmount) : null]
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

  const renderSectionTitle = (icon: React.ComponentProps<typeof FontAwesome6>['name'], title: string, count?: number, tone?: string) => (
    <View style={styles.sectionRow}>
      <LinearGradient colors={tone ? [tone, `${tone}B3`] : headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sectionIcon}>
        <FontAwesome6 name={icon} size={12} color="#FFFFFF" solid />
      </LinearGradient>
      <FullText style={[styles.sectionRowTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </FullText>
      <View style={[styles.sectionRule, { backgroundColor: `${colors.primary}1F` }]} />
      {/* The count at the right, like the customer app's section headers. */}
      {count !== undefined ? (
        <View style={[styles.sectionCount, { backgroundColor: `${tone ?? colors.primary}18` }]}>
          <Text style={[styles.sectionCountText, { color: tone ?? colors.primary }]}>{count}</Text>
        </View>
      ) : null}
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
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{getLocalizedErrorMessage(nearby.error ?? assigned.error, t)}</Text>
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
        <FindJobsButton variant="card" />

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
            : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.problemRow}
                style={styles.problemScroll}
                decelerationRate="fast"
                snapToInterval={PROBLEM_CARD_WIDTH + 10}
              >
                {(nearby.data ?? []).map(renderNearbyProblem)}
              </ScrollView>
            )}

        {recentJobs.length > 0 ? (
          <>
            <StepStack
              title={t('home.recentJobs')}
              steps={recentJobSteps}
              minimized
              live={false}
              hideMore
              accent={colors.primary}
              style={styles.recentStack}
              onSeeAll={() => navigateToBookings('jobs')}
            />
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
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.body}>
          {/* Every request waiting for an answer — jobs and shop orders in one swipe pile — above
              the side switch, since it covers every side. */}
          {profilesLoading ? null : <NewForYou isWorker={isVerifiedWorker} isShop={isVerifiedShop} onSwiping={lockScroll} />}
          {/* Which side you're looking at comes first — only when there is more than one side. */}
          {!profilesLoading && sides.length > 1 ? (
            <View style={[styles.sideSwitch, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              {sides.map((value) => {
                const active = side === value;
                return (
                  <Pressable key={value} onPress={() => setPickedSide(value)} style={[styles.sideOption, active ? { backgroundColor: colors.primary } : null]}>
                    <FontAwesome6 name={SIDE_ICONS[value]} size={12} color={active ? '#FFFFFF' : colors.textMuted} solid />
                    <FullText
                      style={[styles.sideText, { color: active ? '#FFFFFF' : colors.textMuted }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {t(SIDE_LABELS[value])}
                    </FullText>
                    {sideWaiting(value) ? (
                      <View style={[styles.sideDot, { backgroundColor: brandColors.error, borderColor: active ? '#FFFFFF' : colors.surface }]} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {account ? (
            <Text style={[styles.greeting, styles.greetingTight, { color: colors.text }]}>{t('mainTabs.Home.greeting', { name: account.fullName })}</Text>
          ) : null}
          <HomeLocationBar />
          {/* Local businesses' ads, sliding by (only when the admin turned it on). */}
          <HomeAdCarousel />

          {/* Location off: say so first — nothing works without it. */}
          <LocationNeededCard />
          {/* A shop invited this person to deliver: join or not. */}
          <StaffInvitesCard />
          {/* Delivery staff of a shop: the deliveries handed to them. */}
          <StaffDeliveriesCard />
          {/* Job requests while the app is closed: the phone has to allow it. */}
          <BackgroundAlertsCard />
          {/* New requests as a full-screen pop-up: Android 14+ needs it allowed. */}
          <PopupPermissionCard />

          {profilesLoading ? (
            <View style={styles.loading}>
              <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
            </View>
          ) : null}

          {profilesLoading ? null : side === 'job' ? (
            <JobPostHomeSection />
          ) : side === 'shop' && isVerifiedShop && businessProfile.data ? (
            <>
              <ContinueSteps isShop only="orders" />
              <FindOrdersButton />
              {recentOrders.length > 0 ? (
                <>
                  <StepStack
                    title={t('home.recentOrders')}
                    steps={recentOrderSteps}
                    minimized
                    live={false}
                    hideMore
                    accent={colors.primary}
                    style={styles.recentStack}
                    onSeeAll={() => navigateToBookings('orders')}
                  />
                </>
              ) : (
                renderEmpty('bell', t('shopHome.noOrdersTitle'), t('shopHome.noOrdersMessage'))
              )}
            </>
          ) : isVerifiedWorker ? (
            <>
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

// Problems near you: small cards, side by side.
const PROBLEM_CARD_WIDTH = 252;
const PROBLEM_GRADIENT = ['#7C3AED', '#A78BFA'] as const;

const styles = StyleSheet.create({
  problemScroll: { marginHorizontal: -20, marginBottom: 6 },
  problemRow: { paddingHorizontal: 20, gap: 10, paddingVertical: 2 },
  problemCard: {
    width: PROBLEM_CARD_WIDTH,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  problemTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  problemDistance: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, maxWidth: 76 },
  problemDistanceText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11 },
  problemThumb: { width: 54, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  problemInfo: { flex: 1, minWidth: 0, gap: 1 },
  problemSkill: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  problemPrice: { ...typography.body, fontFamily: fonts.bold, fontSize: 16, lineHeight: 21 },
  problemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  problemMeta: { ...typography.caption, fontSize: 11.5, flex: 1 },
  problemDesc: { ...typography.caption, fontSize: 12 },
  problemActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  problemDetails: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  problemDetailsText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5 },
  problemAccept: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 12, alignSelf: 'stretch' },
  problemAcceptText: { ...typography.caption, fontFamily: fonts.semiBold, color: '#FFFFFF', fontSize: 13 },
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
