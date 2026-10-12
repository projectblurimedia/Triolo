import React, { useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';
import { showToast } from '@/state/toastStore';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useAcceptProblem, useAssignedProblems, useMarkWorkDone, useNearbyProblems } from '@/hooks/useProblems';
import { AssignedProblem, NearbyProblem } from '@/services/problemsService';
import { ApiError } from '@/services/apiClient';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { formatDistance } from '@/utils/formatDistance';

const DONE_GRADIENT = ['#16A34A', '#22C55E'] as const;
const FINISHED_PREVIEW_LIMIT = 5;

/**
 * Worker Home — the receiving side of user-app's "Your Problems":
 *  - My Jobs: problems this worker accepted that aren't finished yet, with the customer's
 *    name + a call button, and "Mark Work Done" (the customer then confirms it finished).
 *  - Problems Near You: open problems within range that need one of this worker's skills;
 *    first to accept wins (409 PROBLEM_ALREADY_TAKEN otherwise).
 *  - Finished Jobs: the last few the customer confirmed.
 * Only for a verified Worker capability — a Business-only partner sees an explanation.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const account = useAuthStore((state) => state.account);
  const workerProfile = useMyWorkerProfile();
  const isVerifiedWorker = workerProfile.data?.verificationStatus === 'verified';
  const nearby = useNearbyProblems(isVerifiedWorker);
  const assigned = useAssignedProblems(isVerifiedWorker);
  const acceptProblem = useAcceptProblem();
  const markWorkDone = useMarkWorkDone();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [confirmDoneFor, setConfirmDoneFor] = useState<AssignedProblem | null>(null);

  const skillLabel = (keys: string[]) => keys.map((key) => t(`workerProfile.skills.${key}`)).join(', ');
  const activeJobs = (assigned.data ?? []).filter((job) => job.status !== 'completed');
  const finishedJobs = (assigned.data ?? []).filter((job) => job.status === 'completed').slice(0, FINISHED_PREVIEW_LIMIT);

  const handleAccept = (problem: NearbyProblem) => {
    setAcceptingId(problem.id);
    acceptProblem.mutate(problem.id, {
      onSuccess: () => showToast({ variant: 'success', title: t('problems.acceptedTitle'), message: t('problems.acceptedMessage') }),
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
      onSuccess: () => showToast({ variant: 'success', title: t('problems.workDoneTitle'), message: t('problems.workDoneMessage') }),
      onError: (err) => showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(err, t) }),
      onSettled: () => setConfirmDoneFor(null),
    });
  };

  const callCustomer = (mobileNumber: string) => {
    Linking.openURL(`tel:${mobileNumber}`).catch(() => {});
  };

  const renderPhotos = (photoUrls: string[]) =>
    photoUrls.length > 0 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
        {photoUrls.map((url) => (
          <Image key={url} source={{ uri: url }} style={styles.photo} />
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
    const isWorkDone = job.status === 'work_done';
    return (
      <View key={job.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: brandColors.success }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {skillLabel(job.skillCategories)}
          </Text>
          {isWorkDone
            ? renderStatusPill(t('problems.status.work_done'), brandColors.warning)
            : renderStatusPill(t('problems.status.accepted'), brandColors.success)}
        </View>
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

        {renderMeta('location-dot', job.locationAddress)}
        {job.description ? <Text style={[styles.description, { color: colors.text }]}>{job.description}</Text> : null}
        {renderPhotos(job.photoUrls)}

        <View style={styles.cardAction}>
          {isWorkDone ? (
            <Text style={[styles.waitingText, { color: colors.textMuted }]}>{t('problems.waitingForCustomer')}</Text>
          ) : (
            <Button label={t('problems.markWorkDone')} onPress={() => setConfirmDoneFor(job)} gradient={DONE_GRADIENT} />
          )}
        </View>
      </View>
    );
  };

  const renderNearbyProblem = (problem: NearbyProblem) => (
    <View key={problem.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
      {renderMeta('location-dot', problem.locationAddress)}
      {problem.description ? <Text style={[styles.description, { color: colors.text }]}>{problem.description}</Text> : null}
      {renderPhotos(problem.photoUrls)}
      <View style={styles.cardAction}>
        <Button
          label={t('problems.accept')}
          onPress={() => handleAccept(problem)}
          loading={acceptingId === problem.id}
          disabled={acceptingId !== null && acceptingId !== problem.id}
        />
      </View>
    </View>
  );

  const renderFinishedJob = (job: AssignedProblem) => (
    <View key={job.id} style={[styles.finishedRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <FontAwesome6 name="circle-check" size={18} color={brandColors.success} solid />
      <View style={styles.finishedInfo}>
        <Text style={[styles.finishedTitle, { color: colors.text }]} numberOfLines={1}>
          {skillLabel(job.skillCategories)} · ₹{job.quotationAmount.toLocaleString('en-IN')}
        </Text>
        <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
          {job.customerFullName}
        </Text>
      </View>
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
        {activeJobs.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('problems.myJobsTitle')}</Text>
            {activeJobs.map(renderActiveJob)}
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('problems.nearbyTitle')}</Text>
        {workerProfile.data?.latitude == null
          ? renderEmpty('location-crosshairs', t('problems.noLocationTitle'), t('problems.noLocationMessage'))
          : (nearby.data ?? []).length === 0
            ? renderEmpty('clipboard-list', t('problems.noneNearbyTitle'), t('problems.noneNearbyMessage'))
            : (nearby.data ?? []).map(renderNearbyProblem)}

        {finishedJobs.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('problems.finishedTitle')}</Text>
            {finishedJobs.map(renderFinishedJob)}
          </>
        ) : null}
      </>
    );
  };

  const refreshing = nearby.isRefetching || assigned.isRefetching || workerProfile.isRefetching;
  const onRefresh = () => {
    workerProfile.refetch();
    if (isVerifiedWorker) {
      nearby.refetch();
      assigned.refetch();
    }
  };

  return (
    <ScreenContainer edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {account ? (
          <Text style={[styles.greeting, { color: colors.text }]}>{t('mainTabs.Home.greeting', { name: account.fullName })}</Text>
        ) : null}

        {workerProfile.isLoading ? (
          <View style={styles.loading}>
            <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
          </View>
        ) : isVerifiedWorker ? (
          renderWorkerBody()
        ) : (
          renderEmpty('screwdriver-wrench', t('problems.workersOnlyTitle'), t('problems.workersOnlyMessage'))
        )}
      </ScrollView>

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
  greeting: { ...typography.heading, fontFamily: fonts.semiBold, fontSize: 19, marginBottom: 6 },
  sectionTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginTop: 18, marginBottom: 12 },
  loading: { paddingVertical: 48, alignItems: 'center' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { ...typography.body, fontFamily: fonts.semiBold, flex: 1 },
  quotation: { ...typography.heading, fontFamily: fonts.semiBold, fontSize: 22, marginTop: 6 },
  distancePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
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
  customerRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginTop: 10 },
  customerInfo: { flex: 1 },
  customerLabel: { ...typography.caption, fontSize: 11 },
  customerName: { ...typography.body, fontFamily: fonts.semiBold },
  customerPhone: { ...typography.caption },
  callButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  waitingText: { ...typography.body, fontFamily: fonts.medium, textAlign: 'center', paddingVertical: 8 },
  finishedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10 },
  finishedInfo: { flex: 1 },
  finishedTitle: { ...typography.body, fontFamily: fonts.medium, fontSize: 13 },
  emptyCard: { borderRadius: 16, borderWidth: 1, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 8 },
  emptyTitle: { ...typography.body, fontFamily: fonts.semiBold, textAlign: 'center' },
  emptyMessage: { ...typography.caption, textAlign: 'center', lineHeight: 18 },
  retryWrap: { alignSelf: 'stretch', marginTop: 8 },
});
