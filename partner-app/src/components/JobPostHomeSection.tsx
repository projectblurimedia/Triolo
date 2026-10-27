import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { categoryIcon, formatPay, jobTitle } from './JobPostCard';
import { LoadingIndicator } from './LoadingIndicator';
import { JobPostViewersSheet } from './JobPostViewersSheet';
import { JobPostSummaryCard } from './JobPostSummaryCard';
import { SmartImage } from './SmartImage';
import { useMyJobPosts, useSetJobPostActive } from '@/hooks/useJobPost';
import { JobPost } from '@/services/jobSeekerService';
import { useAuthStore } from '@/state/authStore';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { MainStackParamList, MainTabParamList } from '@/navigation/types';
import { placeName } from '@/utils/formatAddress';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<MainStackParamList>
>;

const SKILLS_SHOWN = 3;
// As many as the server allows (jobSeekers MAX_JOB_POSTS).
const MAX_JOB_POSTS = 5;

/**
 * Home's "Job Post" side: whether customers can see the post (with the Live / Hidden switch
 * right here), the post as customers see it under Hire Staff, and View / Edit. With no post
 * yet, one card inviting the partner to make one.
 */
export function JobPostHomeSection() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const navigation = useNavigation<HomeNavigation>();
  const account = useAuthStore((state) => state.account);
  const { data: posts, isLoading } = useMyJobPosts();
  const setActive = useSetJobPostActive();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<JobPost | null>(null);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <LoadingIndicator size={32} dotSize={5} color={colors.primary} />
      </View>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <Pressable onPress={() => navigation.navigate('JobPost')} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.invite}>
          <FontAwesome6 name="briefcase" size={70} color="rgba(255,255,255,0.14)" solid style={styles.watermark} />
          <View style={styles.inviteIcon}>
            <FontAwesome6 name="plus" size={18} color="#FFFFFF" solid />
          </View>
          <View style={styles.flex}>
            <Text style={styles.inviteTitle}>{t('jobPost.lookingTitle')}</Text>
            <Text style={styles.inviteText} numberOfLines={2}>
              {t('jobPost.lookingSubtitle')}
            </Text>
          </View>
          <FontAwesome6 name="chevron-right" size={14} color="#FFFFFF" solid />
        </LinearGradient>
      </Pressable>
    );
  }

  const shown = posts.find((post) => post.id === pickedId) ?? posts[0];
  return (
    <View>
      {/* Several posts: one chip per post (its own work), the chosen one below. */}
      {posts.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picker}>
          {posts.map((post, index) => {
            const active = post.id === shown.id;
            const inner = (
              <>
                <View style={[styles.pickNumber, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : `${colors.primary}1A` }]}>
                  <Text style={[styles.pickNumberText, { color: active ? '#FFFFFF' : colors.primary }]}>{index + 1}</Text>
                </View>
                <FontAwesome6 name={categoryIcon(post.category) as never} size={12} color={active ? '#FFFFFF' : colors.primary} solid />
                <Text style={[styles.pickText, { color: active ? '#FFFFFF' : colors.text }]} numberOfLines={1}>
                  {jobTitle(post, t)}
                </Text>
                <View
                  style={[styles.pickDot, { backgroundColor: (post.newViews ?? 0) > 0 ? '#EF4444' : post.isActive ? brandColors.success : colors.textMuted }]}
                />
              </>
            );
            return (
              <Pressable key={post.id} onPress={() => setPickedId(post.id)}>
                {active ? (
                  <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pick}>
                    {inner}
                  </LinearGradient>
                ) : (
                  <View style={[styles.pick, { backgroundColor: colors.surface, borderColor: `${colors.primary}33`, borderWidth: 1.5 }]}>{inner}</View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {renderPost(shown)}
      {posts.length < MAX_JOB_POSTS ? (
        <Pressable
          onPress={() => navigation.navigate('JobPost', {})}
          style={({ pressed }) => [styles.addAnother, { borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}0A`, opacity: pressed ? 0.85 : 1 }]}
        >
          <FontAwesome6 name="plus" size={13} color={colors.primary} solid />
          <Text style={[styles.addAnotherText, { color: colors.primary }]}>{t('jobPost.addAnother')}</Text>
        </Pressable>
      ) : null}
      <JobPostViewersSheet postId={viewing?.id ?? null} title={viewing ? jobTitle(viewing, t) : undefined} onClose={() => setViewing(null)} />
      <View style={styles.tip}>
        <FontAwesome6 name="circle-info" size={12} color={colors.textMuted} solid />
        <Text style={[styles.tipText, { color: colors.textMuted }]}>{t('jobPost.homeTip')}</Text>
      </View>
    </View>
  );

  function renderPost(post: JobPost) {
  const live = post.isActive;
  const tone = live ? brandColors.success : colors.textMuted;
  const place = placeName(post.locationAddress);
  const extra = post.skills.length - SKILLS_SHOWN;
  const toggle = (next: boolean) =>
    setActive.mutate({ id: post.id, isActive: next }, {
      onSuccess: () => showToast({ variant: 'success', title: t(next ? 'jobPost.shownToast' : 'jobPost.hiddenToast') }),
      onError: (error) => showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) }),
    });

  const fresh = post.newViews ?? 0;
  const openProfile = () => navigation.navigate('MyInfo', { capability: 'job', postId: post.id });
  return (
    <View>
      <JobPostSummaryCard post={post} onViews={() => setViewing(post)} />

    </View>
  );
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { paddingVertical: 32, alignItems: 'center' },
  invite: { borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -8, bottom: -14 },
  inviteIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  inviteTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  inviteText: { ...typography.caption, color: 'rgba(255,255,255,0.88)', lineHeight: 16 },
  viewsGap: { marginTop: 10 },
  switchBox: { alignItems: 'center' },
  switchText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10.5, lineHeight: 13, marginTop: -2 },
  basics: { flexDirection: 'row', gap: 8 },
  basic: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  basicValue: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13.5, lineHeight: 18 },
  basicLabel: { ...typography.caption, fontSize: 10.5, lineHeight: 13 },
  fullLink: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 11, paddingHorizontal: 9, height: 22 },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  miniText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10.5, lineHeight: 14 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, height: 36 },
  payLabel: { ...typography.caption, fontSize: 12, flex: 1 },
  viewsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1.5, padding: 12, marginTop: 10 },
  newBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#EF4444' },
  newBadgeText: { fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 15, color: '#FFFFFF' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, padding: 12 },
  statusIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  statusText: { ...typography.caption, fontSize: 11.5, lineHeight: 15 },
  label: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  preview: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    shadowColor: '#0B3A8A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  previewTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  name: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15 },
  work: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5 },
  pay: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, maxWidth: 160 },
  chipText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, paddingTop: 9 },
  placeText: { ...typography.caption, fontSize: 12, flex: 1 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, borderWidth: 1.5 },
  buttonFill: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  buttonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46 },
  buttonText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  tip: { flexDirection: 'row', gap: 8, marginTop: 16, paddingHorizontal: 4 },
  picker: { gap: 8, paddingBottom: 14 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, borderRadius: 19, paddingHorizontal: 10, maxWidth: 220 },
  pickNumber: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pickNumberText: { fontFamily: fonts.semiBold, fontSize: 10.5, lineHeight: 14 },
  pickText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
  pickDot: { width: 7, height: 7, borderRadius: 4 },
  addAnother: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 16 },
  addAnotherText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  tipText: { ...typography.caption, fontSize: 11.5, lineHeight: 16, flex: 1 },
});
