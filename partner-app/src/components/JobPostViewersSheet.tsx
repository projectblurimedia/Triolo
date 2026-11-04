import React, { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassBackdrop, GlassCard } from './Glass';
import { GoldCard, GOLD_BUTTON, GOLD_DEEP, GOLD_INK, GOLD_INK_SOFT } from './GoldCard';
import { LoadingIndicator } from './LoadingIndicator';
import { JOB_POST_QUERY_KEY } from '@/hooks/useJobPost';
import { NOTIFICATIONS_QUERY_KEY } from '@/hooks/useNotifications';
import { useMySubscription } from '@/hooks/useSubscription';
import { JobPostViewer, jobSeekerService } from '@/services/jobSeekerService';
import { payIfNeeded } from '@/state/payGateStore';
import { openSubscribe } from '@/state/subscribeStore';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { FullText } from '@/components/FullText';

// "5m" / "3h" / "2d" ago (kept here rather than imported, so NotificationsModal can open this sheet).
function ago(iso: string, justNow: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return justNow;
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

/**
 * Who opened one of my job posts. With plans off or on the Job Post plan: their names and
 * numbers with a Call button. Without the plan: each person is a locked row (the times still
 * show) with its own Unlock button (a small one-time fee for that person), and the plan is
 * offered for seeing everyone. Opening it marks the views seen, so the red dots and the post's
 * notifications clear.
 */
export function JobPostViewersSheet({ postId, title, onClose }: { postId: string | null; title?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const queryClient = useQueryClient();
  const subscription = useMySubscription();
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const viewers = useQuery({
    queryKey: ['job-posts', 'viewers', postId],
    queryFn: () => jobSeekerService.viewers(postId as string),
    enabled: !!postId,
    placeholderData: (previous) => previous,
  });

  // Once they've been shown, they're no longer new.
  const shownNew = (viewers.data?.newCount ?? 0) > 0;
  useEffect(() => {
    if (!postId || !shownNew) return;
    jobSeekerService
      .markViewsSeen(postId)
      .then(() =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: JOB_POST_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
        ]),
      )
      .catch(() => undefined);
  }, [postId, shownNew, queryClient]);

  const data = viewers.data;
  const fee = subscription.data?.fees?.job_post_viewer ?? 0;

  const unlock = async (viewer: JobPostViewer) => {
    if (unlocking) return;
    setUnlocking(viewer.viewerKey);
    try {
      if (await payIfNeeded('job_post_viewer', viewer.viewerKey)) await viewers.refetch();
    } finally {
      setUnlocking(null);
    }
  };

  const seePlans = () => {
    onClose();
    openSubscribe('job_post');
  };

  const renderRow = (viewer: JobPostViewer) => {
    const locked = !!viewer.locked || (data?.locked && !viewer.name);
    const meta = `${ago(viewer.lastViewedAt, t('notifications.justNow'))}${viewer.times > 1 ? ` · ${t('jobViews.times', { count: viewer.times })}` : ''}`;
    if (locked) {
      return (
        <View key={viewer.viewerKey} style={[styles.row, styles.lockedRow, { borderColor: `${GOLD_DEEP}55`, backgroundColor: `${GOLD_DEEP}0D` }]}>
          <LinearGradient colors={GOLD_BUTTON} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <FontAwesome6 name="lock" size={13} color="#FFFFFF" solid />
          </LinearGradient>
          <View style={styles.flex}>
            {/* Stand-ins for the hidden name and number, shaped like the real thing. */}
            <View style={styles.blurLine}>
              <View style={[styles.blurBar, { width: 92, backgroundColor: `${GOLD_DEEP}40` }]} />
              <View style={[styles.blurBar, { width: 54, backgroundColor: `${GOLD_DEEP}2E` }]} />
            </View>
            <FullText style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
              {t('jobViews.hiddenNumber')} · {meta}
            </FullText>
          </View>
          {viewer.isNew ? <View style={[styles.newDot, { backgroundColor: brandColors.error }]} /> : null}
          <Pressable onPress={() => unlock(viewer)} disabled={!!unlocking} accessibilityRole="button" style={({ pressed }) => [styles.unlockWrap, { opacity: pressed ? 0.9 : 1 }]}>
            <LinearGradient colors={GOLD_BUTTON} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.unlock}>
              {unlocking === viewer.viewerKey ? (
                <LoadingIndicator size={16} dotSize={3} color="#FFFFFF" />
              ) : (
                <>
                  <FontAwesome6 name="unlock" size={11} color="#FFFFFF" solid />
                  <Text style={styles.unlockText}>{fee > 0 ? `₹${fee}` : t('jobViews.unlock')}</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      );
    }
    return (
      <View
        key={viewer.viewerKey}
        style={[styles.row, { backgroundColor: colors.surface, borderColor: viewer.isNew ? `${brandColors.error}55` : colors.border }]}
      >
        <View style={[styles.avatar, { backgroundColor: `${colors.primary}14` }]}>
          <FontAwesome6 name="user" size={14} color={colors.primary} solid />
        </View>
        <View style={styles.flex}>
          <FullText style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {viewer.name ?? t('jobViews.someone')}
          </FullText>
          <FullText style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {meta}
          </FullText>
        </View>
        {viewer.isNew ? (
          <View style={[styles.newPill, { backgroundColor: `${brandColors.error}14` }]}>
            <Text style={[styles.newText, { color: brandColors.error }]}>{t('jobViews.new')}</Text>
          </View>
        ) : null}
        {viewer.mobile ? (
          <Pressable
            onPress={() => Linking.openURL(`tel:${viewer.mobile}`).catch(() => undefined)}
            accessibilityLabel={t('jobViews.call')}
            style={[styles.call, { backgroundColor: brandColors.success }]}
          >
            <FontAwesome6 name="phone" size={13} color="#FFFFFF" solid />
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <Modal visible={postId !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GlassBackdrop onPress={onClose} style={styles.overlay}>
        <GlassCard style={styles.sheet}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
            <View style={styles.headIcon}>
              <FontAwesome6 name="users-viewfinder" size={16} color="#FFFFFF" solid />
            </View>
            <View style={styles.flex}>
              <Text style={styles.title}>{t('jobViews.title')}</Text>
              <FullText style={styles.subtitle} numberOfLines={1}>
                {title ? `${title} · ` : ''}
                {t('jobViews.total', { count: data?.total ?? 0 })}
              </FullText>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
              <FontAwesome6 name="xmark" size={14} color="#FFFFFF" solid />
            </Pressable>
          </LinearGradient>

          {viewers.isLoading ? (
            <View style={styles.state}>
              <LoadingIndicator size={32} dotSize={5} color={colors.primary} />
            </View>
          ) : !data || data.viewers.length === 0 ? (
            <View style={styles.state}>
              <FontAwesome6 name="eye-slash" size={20} color={colors.textMuted} solid />
              <Text style={[styles.stateText, { color: colors.textMuted }]}>{t('jobViews.none')}</Text>
            </View>
          ) : (
            <>
              {data.locked ? (
                // Everyone at once, free: the Job Post plan.
                <GoldCard style={styles.offer}>
                  <View style={styles.offerRow}>
                    <View style={styles.offerIcon}>
                      <FontAwesome6 name="users" size={15} color={GOLD_DEEP} solid />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.offerTitle}>{t('jobViews.lockedTitle')}</Text>
                      <Text style={styles.offerText}>{t('jobViews.lockedText')}</Text>
                    </View>
                  </View>
                  <Pressable onPress={seePlans} style={({ pressed }) => [styles.offerButton, { opacity: pressed ? 0.9 : 1 }]}>
                    <FontAwesome6 name="crown" size={11} color="#FFE29A" solid />
                    <Text style={styles.offerButtonText}>{t('jobViews.getPlan')}</Text>
                  </Pressable>
                </GoldCard>
              ) : null}
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {data.viewers.map(renderRow)}
              </ScrollView>
            </>
          )}
        </GlassCard>
      </GlassBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  sheet: { borderRadius: 22, padding: 12, maxHeight: '85%', gap: 10, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12 },
  headIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  subtitle: { ...typography.caption, fontSize: 12, color: 'rgba(255,255,255,0.88)' },
  close: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  state: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  stateText: { ...typography.body, fontSize: 14, textAlign: 'center' },
  offer: { padding: 12, gap: 10 },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  offerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, color: GOLD_INK },
  offerText: { ...typography.caption, fontSize: 12, lineHeight: 16, color: GOLD_INK_SOFT },
  offerButton: { flexDirection: 'row', gap: 7, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: GOLD_INK },
  offerButtonText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13, color: '#FFE29A', includeFontPadding: false },
  // Shrinks to the room left in the sheet and scrolls (it was clipped after the first rows).
  list: { flexGrow: 0, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, padding: 10, marginBottom: 8 },
  lockedRow: { borderStyle: 'dashed' },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  blurLine: { flexDirection: 'row', gap: 6, marginBottom: 6, marginTop: 2 },
  blurBar: { height: 11, borderRadius: 6 },
  name: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  meta: { ...typography.caption, fontSize: 11.5 },
  newPill: { borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2 },
  newText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10 },
  newDot: { width: 8, height: 8, borderRadius: 4 },
  unlockWrap: { borderRadius: 17, overflow: 'hidden', backgroundColor: GOLD_BUTTON[1] },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, minWidth: 70, justifyContent: 'center', paddingHorizontal: 12 },
  unlockText: { fontFamily: fonts.semiBold, fontSize: 12.5, color: '#FFFFFF', includeFontPadding: false },
  call: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
