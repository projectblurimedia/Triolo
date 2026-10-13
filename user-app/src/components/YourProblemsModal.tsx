import React, { useState } from 'react';
import { FlatList, Image, Linking, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { ConfirmModal } from './ConfirmModal';
import { LoadingIndicator } from './LoadingIndicator';
import { ProblemFormModal } from './ProblemFormModal';
import { FinishJobModal } from './FinishJobModal';
import { STAR_COLOR } from './RatingStars';
import { ToastHost } from './ToastHost';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { ProblemPost, ProblemStatus } from '@/services/problemsService';
import { useCompleteProblem, useDeleteProblem, useMyProblems } from '@/hooks/useProblems';
import { showToast } from '@/state/toastStore';
import { openBookingTracker } from '@/state/bookingTrackerStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';

interface YourProblemsModalProps {
  visible: boolean;
  onClose: () => void;
}

const DELETE_GRADIENT = ['#ef4444', '#dc2626'] as const;
const FINISH_GRADIENT = ['#16A34A', '#22C55E'] as const;
const THUMB_SIZE = 64;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Manual, not toLocaleDateString — Hermes on Android doesn't reliably ship full Intl data.
function formatPostedDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Services menu's "Your Problems" — every problem this account has posted (status, worker
 * type, quotation, location, photos), plus "Add New Problem". Actions follow the job flow:
 *  - open: Edit / Delete (add and edit share ProblemFormModal, opened on top of this one)
 *  - accepted / work_done: the assigned worker's name + call button, and "Mark as Finished"
 *    (the customer confirms the finish — the worker's "Work Done" only prompts them to)
 *  - completed: Delete only
 * Polled while open so a worker accepting shows up without a manual refresh.
 */
export function YourProblemsModal({ visible, onClose }: YourProblemsModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const problems = useMyProblems(visible);
  const deleteProblem = useDeleteProblem();
  const completeProblem = useCompleteProblem();
  const [formVisible, setFormVisible] = useState(false);
  const [editingProblem, setEditingProblem] = useState<ProblemPost | null>(null);
  const [deletingProblem, setDeletingProblem] = useState<ProblemPost | null>(null);
  const [finishingProblem, setFinishingProblem] = useState<ProblemPost | null>(null);

  const openAdd = () => {
    setEditingProblem(null);
    setFormVisible(true);
  };

  const openEdit = (problem: ProblemPost) => {
    setEditingProblem(problem);
    setFormVisible(true);
  };

  const confirmDelete = () => {
    if (!deletingProblem) return;
    deleteProblem.mutate(deletingProblem.id, {
      onSuccess: () => {
        setDeletingProblem(null);
        showToast({ variant: 'success', title: t('yourProblems.deletedTitle') });
      },
      onError: (error) => {
        setDeletingProblem(null);
        showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
      },
    });
  };

  const confirmFinished = (rating: number, review: string) => {
    if (!finishingProblem) return;
    completeProblem.mutate({ postId: finishingProblem.id, rating, review }, {
      onSuccess: () => showToast({ variant: 'success', title: t('yourProblems.finishedToastTitle') }),
      onError: (error) =>
        showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) }),
      onSettled: () => setFinishingProblem(null),
    });
  };

  const statusColorFor = (status: ProblemStatus): string => {
    switch (status) {
      case 'open':
        return colors.primary;
      case 'accepted':
        return brandColors.success;
      case 'work_done':
        return brandColors.warning;
      default:
        return colors.textMuted;
    }
  };

  const renderActions = (item: ProblemPost) => {
    if (item.status === 'open') {
      return (
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          <Pressable style={styles.actionButton} onPress={() => openEdit(item)} hitSlop={6}>
            <FontAwesome6 name="pen" size={13} color={colors.primary} solid />
            <Text style={[styles.actionText, { color: colors.primary }]}>{t('common.edit')}</Text>
          </Pressable>
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <Pressable style={styles.actionButton} onPress={() => setDeletingProblem(item)} hitSlop={6}>
            <FontAwesome6 name="trash" size={13} color={brandColors.error} solid />
            <Text style={[styles.actionText, { color: brandColors.error }]}>{t('common.delete')}</Text>
          </Pressable>
        </View>
      );
    }
    // Accepted since problems became trips: everything (live map, PIN, finish + rating)
    // happens in the same tracker as Quick Book.
    if (item.bookingRequestId && (item.status === 'accepted' || item.status === 'work_done')) {
      const tripId = item.bookingRequestId;
      return (
        <View style={styles.finishWrap}>
          <Button label={t('yourProblems.trackJob')} onPress={() => openBookingTracker(tripId)} />
        </View>
      );
    }
    if (item.status === 'accepted' || item.status === 'work_done') {
      return (
        <View style={styles.finishWrap}>
          <Button label={t('yourProblems.markFinished')} onPress={() => setFinishingProblem(item)} gradient={FINISH_GRADIENT} />
        </View>
      );
    }
    // Finished — editing makes no sense any more, but the customer can clear it from the list.
    return (
      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <Pressable style={styles.actionButton} onPress={() => setDeletingProblem(item)} hitSlop={6}>
          <FontAwesome6 name="trash" size={13} color={brandColors.error} solid />
          <Text style={[styles.actionText, { color: brandColors.error }]}>{t('common.delete')}</Text>
        </Pressable>
      </View>
    );
  };

  const renderWorker = (item: ProblemPost) => {
    if (!item.acceptedWorkerFullName) return null;
    return (
      <View style={[styles.workerBox, { backgroundColor: `${brandColors.success}12` }]}>
        <View style={styles.workerInfo}>
          <Text style={[styles.workerLabel, { color: colors.textMuted }]}>{t('yourProblems.assignedWorker')}</Text>
          <Text style={[styles.workerName, { color: colors.text }]}>{item.acceptedWorkerFullName}</Text>
          {item.acceptedWorkerMobileNumber ? (
            <Text style={[styles.workerPhone, { color: colors.textMuted }]}>{item.acceptedWorkerMobileNumber}</Text>
          ) : null}
        </View>
        {item.acceptedWorkerMobileNumber && item.status !== 'completed' ? (
          <Pressable
            style={[styles.callButton, { backgroundColor: brandColors.success }]}
            onPress={() => Linking.openURL(`tel:${item.acceptedWorkerMobileNumber}`).catch(() => {})}
            accessibilityLabel={t('yourProblems.callWorker')}
          >
            <FontAwesome6 name="phone" size={15} color="#FFFFFF" solid />
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderItem = ({ item }: { item: ProblemPost }) => {
    const statusColor = statusColorFor(item.status);
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardTop}>
          {item.photoUrls[0] ? (
            <Image source={{ uri: item.photoUrls[0] }} style={styles.thumb} />
          ) : (
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumb}>
              <FontAwesome6 name="screwdriver-wrench" size={22} color="#FFFFFF" solid />
            </LinearGradient>
          )}
          <View style={styles.cardInfo}>
            <View style={styles.titleRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {item.skillCategories.map((key) => t(`workerProfile.skills.${key}`)).join(', ')}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: `${statusColor}1A` }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{item.bookingStatus && item.status !== 'completed'
                    ? t(`tracking.status.${item.bookingStatus}.title`)
                    : t(`yourProblems.status.${item.status}`)}
                </Text>
              </View>
            </View>
            <Text style={[styles.quotation, { color: colors.primary }]}>₹{item.quotationAmount.toLocaleString('en-IN')}</Text>
            {item.locationAddress ? (
              <View style={styles.metaRow}>
                <FontAwesome6 name="location-dot" size={11} color={colors.textMuted} solid />
                <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
                  {item.locationAddress}
                </Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <FontAwesome6 name="clock" size={11} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {t('yourProblems.postedOn', { date: formatPostedDate(item.createdAt) })}
                {item.photoUrls.length > 0 ? ` · ${t('yourProblems.photoCount', { count: item.photoUrls.length })}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {item.description ? (
          <Text style={[styles.description, { color: colors.text }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {renderWorker(item)}

        {item.status === 'completed' && item.workerRating ? (
          <View style={styles.yourRating}>
            <Text style={[styles.yourRatingLabel, { color: colors.textMuted }]}>{t('yourProblems.yourRating')}</Text>
            {[1, 2, 3, 4, 5].map((star) => (
              <FontAwesome6 key={star} name="star" size={12} color={star <= (item.workerRating ?? 0) ? STAR_COLOR : colors.border} solid />
            ))}
          </View>
        ) : null}

        {item.status === 'work_done' ? (
          <Text style={[styles.statusHint, { color: brandColors.warning }]}>{t('yourProblems.workDoneHint')}</Text>
        ) : null}

        {renderActions(item)}
      </View>
    );
  };

  const renderBody = () => {
    if (problems.isLoading) {
      return (
        <View style={styles.centerBody}>
          <LoadingIndicator size={40} dotSize={6} color={colors.primary} />
        </View>
      );
    }
    if (problems.isError) {
      return (
        <View style={styles.centerBody}>
          <Text style={[styles.stateTitle, { color: colors.text }]}>{t('yourProblems.loadFailedTitle')}</Text>
          <Text style={[styles.stateMessage, { color: colors.textMuted }]}>
            {getLocalizedErrorMessage(problems.error, t)}
          </Text>
          <View style={styles.retryWrap}>
            <Button label={t('common.retry')} onPress={() => problems.refetch()} />
          </View>
        </View>
      );
    }
    return (
      <FlatList
        data={problems.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={problems.isRefetching} onRefresh={() => problems.refetch()} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyBody}>
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyIcon}>
              <FontAwesome6 name="clipboard-list" size={28} color="#FFFFFF" solid />
            </LinearGradient>
            <Text style={[styles.stateTitle, { color: colors.text }]}>{t('yourProblems.emptyTitle')}</Text>
            <Text style={[styles.stateMessage, { color: colors.textMuted }]}>{t('yourProblems.emptyMessage')}</Text>
          </View>
        }
      />
    );
  };

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
            <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.cancel')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.titleGroup}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {t('yourProblems.title')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t('yourProblems.subtitle')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {renderBody()}

        <View style={[styles.addWrap, { borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
          <Button label={t('yourProblems.addNew')} onPress={openAdd} />
        </View>

        <ToastHost />
      </View>

      <ProblemFormModal visible={formVisible} onClose={() => setFormVisible(false)} problem={editingProblem} />

      <ConfirmModal
        visible={deletingProblem !== null}
        icon="trash"
        gradient={DELETE_GRADIENT}
        title={t('yourProblems.deleteConfirmTitle')}
        message={t('yourProblems.deleteConfirmMessage')}
        confirmLabel={t('common.delete')}
        loading={deleteProblem.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingProblem(null)}
      />

      <FinishJobModal
        visible={finishingProblem !== null}
        workerName={finishingProblem?.acceptedWorkerFullName ?? null}
        loading={completeProblem.isPending}
        onConfirm={confirmFinished}
        onCancel={() => setFinishingProblem(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 20, paddingHorizontal: 20 },
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
  listContent: { padding: 20, paddingBottom: 32, flexGrow: 1 },
  card: { borderWidth: 1, borderRadius: 14, marginBottom: 14, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', padding: 14, gap: 12 },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { ...typography.body, fontFamily: fonts.semiBold, flex: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 11 },
  quotation: { ...typography.subheading, fontFamily: fonts.semiBold, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText: { ...typography.caption, flex: 1 },
  description: { ...typography.body, fontSize: 13, paddingHorizontal: 14, paddingBottom: 12, marginTop: -4 },
  workerBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginHorizontal: 14, marginBottom: 12 },
  workerInfo: { flex: 1 },
  workerLabel: { ...typography.caption, fontSize: 11 },
  workerName: { ...typography.body, fontFamily: fonts.semiBold },
  workerPhone: { ...typography.caption },
  callButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statusHint: { ...typography.caption, fontFamily: fonts.medium, paddingHorizontal: 14, marginBottom: 10 },
  finishWrap: { paddingHorizontal: 14, paddingBottom: 14 },
  yourRating: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 14, marginBottom: 12 },
  yourRatingLabel: { ...typography.caption, marginRight: 4 },
  actions: { flexDirection: 'row', borderTopWidth: 1 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12 },
  actionDivider: { width: 1 },
  actionText: { ...typography.body, fontFamily: fonts.medium, fontSize: 13 },
  centerBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  stateMessage: { ...typography.body, textAlign: 'center', lineHeight: 20 },
  retryWrap: { width: '100%', marginTop: 20 },
  addWrap: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
});
