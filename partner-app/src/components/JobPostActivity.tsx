import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LoadingIndicator } from './LoadingIndicator';
import { SmartImage } from './SmartImage';
import { categoryIcon, formatPay, jobTitle } from './JobPostCard';
import { ActivitySummary } from './ActivitySummary';
import { JobPostViewersSheet } from './JobPostViewersSheet';
import { JobPostSummaryCard } from './JobPostSummaryCard';
import { useMyJobPosts } from '@/hooks/useJobPost';
import { JobPost } from '@/services/jobSeekerService';
import { MainStackParamList, MainTabParamList } from '@/navigation/types';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

type Navigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Bookings'>,
  NativeStackNavigationProp<MainStackParamList>
>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Manual, not toLocale* — Hermes on Android doesn't reliably ship full Intl data.
function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
}

/**
 * Activity's Job Post side: total visits on top, then one card per post — numbered with its
 * own work and photo so two posts never look alike — with its visits, when it went up and
 * last changed, and View / Edit. Calls aren't kept in the app (customers phone directly).
 */
export function JobPostActivity() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const navigation = useNavigation<Navigation>();
  const { data: posts, isLoading } = useMyJobPosts();
  // The post whose views are open.
  const [viewing, setViewing] = useState<JobPost | null>(null);

  if (isLoading) {
    return (
      <View style={styles.state}>
        <LoadingIndicator color={colors.primary} />
      </View>
    );
  }
  if (!posts || posts.length === 0) {
    return (
      <View style={styles.state}>
        <FontAwesome6 name="briefcase" size={22} color={colors.textMuted} solid />
        <Text style={[styles.stateTitle, { color: colors.text }]}>{t('jobPost.lookingTitle')}</Text>
        <Pressable onPress={() => navigation.navigate('JobPost', {})} style={[styles.outline, { borderColor: colors.primary }]}>
          <Text style={[styles.outlineText, { color: colors.primary }]}>{t('jobPost.post')}</Text>
        </Pressable>
      </View>
    );
  }

  const visits = posts.reduce((sum, post) => sum + (post.viewCount ?? 0), 0);
  const live = posts.filter((post) => post.isActive).length;
  const many = posts.length > 1;

  const renderPost = (post: JobPost, index: number) => {
    const isLive = post.isActive;
    const tone = isLive ? brandColors.success : colors.textMuted;
    const changed = post.updatedAt !== post.createdAt;
    const tiles = [
      { icon: 'calendar-plus', value: formatDate(post.createdAt), label: t('activity.posted') },
      { icon: 'pen', value: changed ? formatDate(post.updatedAt) : '—', label: t('activity.updated') },
    ] as const;
    return (
      <View key={post.id} style={styles.postWrap}>
        <JobPostSummaryCard post={post} onViews={() => setViewing(post)} />

      </View>
    );
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
      <ActivitySummary
        icon="eye"
        label={t('activity.visitsLabel')}
        value={String(visits)}
        gradient={headerGradient}
        stats={[
          { icon: 'briefcase', value: posts.length, label: t('activity.posts') },
          { icon: 'circle-check', value: live, label: t('jobPost.statusLive') },
          { icon: 'eye-slash', value: posts.length - live, label: t('jobPost.statusHidden') },
        ]}
      />
      {many ? <Text style={[styles.section, { color: colors.textMuted }]}>{t('jobPost.postsTitle')}</Text> : null}
      {posts.map(renderPost)}
      <View style={[styles.note, { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}26` }]}>
        <FontAwesome6 name="phone" size={13} color={colors.primary} solid />
        <Text style={[styles.noteText, { color: colors.text }]}>{t('activity.jobCallsNote')}</Text>
      </View>
      <JobPostViewersSheet postId={viewing?.id ?? null} title={viewing ? jobTitle(viewing, t) : undefined} onClose={() => setViewing(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: 12, paddingBottom: 120 },
  state: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48 },
  stateTitle: { ...typography.body, fontFamily: fonts.semiBold, textAlign: 'center' },
  outline: { borderWidth: 1.5, borderRadius: 14, height: 42, paddingHorizontal: 18, justifyContent: 'center' },
  outlineText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  section: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 },
  card: { borderRadius: 18, borderWidth: 2, padding: 12, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  number: { position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontFamily: fonts.semiBold, fontSize: 10, lineHeight: 13, color: '#FFFFFF' },
  workRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15, flexShrink: 1 },
  pay: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, borderWidth: 1, paddingHorizontal: 9, height: 24 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 15 },
  postWrap: { gap: 10 },
  dates: { ...typography.caption, fontSize: 11.5, marginTop: -4 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  tileValue: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13.5, lineHeight: 18 },
  tileLabel: { ...typography.caption, fontSize: 10.5 },
  freshBadge: { position: 'absolute', top: -7, right: -5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  freshText: { fontFamily: fonts.semiBold, fontSize: 10, lineHeight: 13, color: '#FFFFFF' },
  buttons: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 40, borderRadius: 12, borderWidth: 1.5 },
  buttonFill: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  buttonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 40 },
  buttonText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13.5 },
  note: { flexDirection: 'row', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 4 },
  noteText: { ...typography.caption, fontSize: 12.5, lineHeight: 18, flex: 1 },
});
