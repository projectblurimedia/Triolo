import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { NewForYou } from './NewForYou';
import { ContinueSteps } from './ContinueSteps';
import { StaffInvitesCard } from './StaffInvitesCard';
import { StaffDeliveriesCard } from './StaffDeliveriesCard';
import { ProblemDetailModal } from './ProblemDetailModal';
import { LoadingIndicator } from './LoadingIndicator';
import { ToastHost } from './ToastHost';
import { useForYouStore } from '@/state/forYouStore';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyBusinessProfile, useStaffInvites } from '@/hooks/useBusinessMutations';
import { useBookingOffers } from '@/hooks/useBookingOffers';
import { useShopOrders } from '@/hooks/useShopOrders';
import { jobQueryKey, useMyJobs } from '@/hooks/useJobs';
import { useAcceptProblem, useNearbyProblems } from '@/hooks/useProblems';
import { NearbyProblem } from '@/services/problemsService';
import { ACTIVE_JOB_STATUSES, jobsService } from '@/services/jobsService';
import { ACTIVE_SHOP_STATUSES, NEW_ORDER_STATUSES } from '@/services/shopOrdersService';
import { ApiError } from '@/services/apiClient';
import { openJob } from '@/state/jobFocusStore';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { formatDistance } from '@/utils/formatDistance';
import { placeName } from '@/utils/formatAddress';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];
const MODAL_HANDOFF_MS = 350;

/**
 * The menu's quick lists, full screen and always reachable (not only from Home):
 * - New for you: shop invitations (including ones put off with Later), job requests, new orders.
 * - Problems near you: open problems a verified worker can take.
 * - Continue where you left off: jobs and orders under way.
 */
export function ForYouModal() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const mode = useForYouStore((state) => state.mode);
  const close = useForYouStore((state) => state.close);
  const open = mode !== null;

  const worker = useMyWorkerProfile(open).data;
  const shop = useMyBusinessProfile(open).data;
  const isWorker = worker?.verificationStatus === 'verified';
  const isShop = shop?.verificationStatus === 'verified';

  const invites = useStaffInvites();
  const offers = useBookingOffers();
  const orders = useShopOrders(open && isShop);
  const jobs = useMyJobs();

  const newCount =
    (invites.data ?? []).length +
    (isWorker ? (offers.data ?? []).length : 0) +
    (isShop ? (orders.data ?? []).filter((order) => NEW_ORDER_STATUSES.includes(order.status)).length : 0);
  const continueCount =
    (isWorker ? (jobs.data ?? []).filter((job) => ACTIVE_JOB_STATUSES.includes(job.status)).length : 0) +
    (isShop ? (orders.data ?? []).filter((order) => ACTIVE_SHOP_STATUSES.includes(order.status)).length : 0);

  const titles: Record<'new' | 'problems' | 'continue', { title: string; subtitle: string; icon: IconName }> = {
    new: { title: t('forYou.newTitle'), subtitle: t('forYou.newSubtitle'), icon: 'bell' },
    problems: { title: t('forYou.problemsTitle'), subtitle: t('forYou.problemsSubtitle'), icon: 'clipboard-list' },
    continue: { title: t('forYou.continueTitle'), subtitle: t('forYou.continueSubtitle'), icon: 'forward' },
  };
  const head = titles[mode ?? 'new'];

  const empty = (icon: IconName, title: string, text: string) => (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}14` }]}>
        <FontAwesome6 name={icon} size={24} color={colors.primary} solid />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>{text}</Text>
    </View>
  );

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Pressable style={styles.backButton} onPress={close} accessibilityLabel={t('common.close')} hitSlop={8}>
            <FontAwesome6 name="chevron-left" size={16} color="#FFFFFF" solid />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.headerTitle}>{head.title}</Text>
            <Text style={styles.headerSubtitle}>{head.subtitle}</Text>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          {mode === 'new' ? (
            <>
              <StaffInvitesCard />
              <NewForYou isWorker={isWorker} isShop={isShop} />
              {newCount === 0 ? empty('bell-slash', t('forYou.newEmptyTitle'), t('forYou.newEmptyText')) : null}
            </>
          ) : null}
          {mode === 'continue' ? (
            <>
              <StaffDeliveriesCard />
              {isWorker ? <ContinueSteps isShop={false} only="jobs" /> : null}
              {isShop ? <ContinueSteps isShop only="orders" /> : null}
              {continueCount === 0 ? empty('mug-hot', t('forYou.continueEmptyTitle'), t('forYou.continueEmptyText')) : null}
            </>
          ) : null}
          {mode === 'problems' ? (
            isWorker ? (
              <NearbyProblems onDone={close} />
            ) : (
              empty('screwdriver-wrench', t('problems.workersOnlyTitle'), t('problems.workersOnlyMessage'))
            )
          ) : null}
        </ScrollView>
        <ToastHost />
      </View>
    </Modal>
  );
}

function NearbyProblems({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const nearby = useNearbyProblems(true);
  const accept = useAcceptProblem();
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<NearbyProblem | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const skillLabel = (keys: string[]) => keys.map((key) => t(`workerProfile.skills.${key}`)).join(', ');

  const handleAccept = (problem: NearbyProblem) => {
    setAcceptingId(problem.id);
    accept.mutate(problem.id, {
      onSuccess: async (accepted) => {
        showToast({ variant: 'success', title: t('problems.acceptedTitle'), message: t('problems.acceptedMessage') });
        const tripId = accepted.bookingRequestId;
        setDetail(null);
        if (!tripId) return;
        // The job screen opens on top once this list closes.
        await queryClient.prefetchQuery({ queryKey: jobQueryKey(tripId), queryFn: () => jobsService.get(tripId) }).catch(() => {});
        onDone();
        setTimeout(() => openJob(tripId), MODAL_HANDOFF_MS);
      },
      onError: (err) => {
        const taken = err instanceof ApiError && err.code === 'PROBLEM_ALREADY_TAKEN';
        showToast(
          taken
            ? { variant: 'info', title: t('problems.takenTitle'), message: t('problems.takenMessage') }
            : { variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(err, t) },
        );
        if (taken) nearby.refetch();
      },
      onSettled: () => setAcceptingId(null),
    });
  };

  if (nearby.isLoading) {
    return (
      <View style={styles.center}>
        <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
      </View>
    );
  }
  const list = nearby.data ?? [];
  if (list.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}14` }]}>
          <FontAwesome6 name="clipboard-list" size={24} color={colors.primary} solid />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('forYou.problemsEmptyTitle')}</Text>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('forYou.problemsEmptyText')}</Text>
      </View>
    );
  }

  return (
    <>
      {list.map((problem) => (
        <Pressable
          key={problem.id}
          onPress={() => setDetail(problem)}
          style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: `${colors.primary}26`, opacity: pressed ? 0.92 : 1 }]}
        >
          <View style={styles.cardTop}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {skillLabel(problem.skillCategories)}
            </Text>
            <View style={[styles.pill, { backgroundColor: `${colors.primary}16` }]}>
              <FontAwesome6 name="location-arrow" size={10} color={colors.primary} solid />
              <Text style={[styles.pillText, { color: colors.primary }]}>
                {t('problems.distanceAway', { distance: formatDistance(problem.distanceMeters) })}
              </Text>
            </View>
          </View>
          <Text style={[styles.amount, { color: colors.primary }]}>₹{problem.quotationAmount.toLocaleString('en-IN')}</Text>
          {problem.locationAddress ? (
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
              {placeName(problem.locationAddress)}
            </Text>
          ) : null}
          {problem.description ? (
            <Text style={[styles.description, { color: colors.text }]} numberOfLines={2}>
              {problem.description}
            </Text>
          ) : null}
          <View style={styles.viewRow}>
            <Text style={[styles.viewText, { color: colors.primary }]}>{t('problemDetail.viewDetails')}</Text>
            <FontAwesome6 name="chevron-right" size={11} color={colors.primary} solid />
          </View>
        </Pressable>
      ))}
      <ProblemDetailModal
        problem={detail}
        onClose={() => setDetail(null)}
        onAccept={detail ? () => handleAccept(detail) : undefined}
        accepting={detail !== null && acceptingId === detail.id}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 16 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 18 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  body: { padding: 16 },
  center: { alignItems: 'center', paddingVertical: 40 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 16, gap: 10 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...typography.subheading, fontFamily: fonts.semiBold, textAlign: 'center' },
  emptyText: { ...typography.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15, flex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11 },
  amount: { ...typography.subheading, fontFamily: fonts.semiBold, fontSize: 17 },
  meta: { ...typography.caption, fontSize: 12 },
  description: { ...typography.body, fontSize: 13, lineHeight: 18 },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  viewText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5 },
});
