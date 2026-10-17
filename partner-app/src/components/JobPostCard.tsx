import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { JOB_CATEGORIES, JobPost } from '@/services/jobSeekerService';
import { formatRupees } from '@/services/shopOrdersService';
import { SmartImage } from './SmartImage';

/** "₹30,000 / month" — shared with the Home section. */
export function formatPay(post: Pick<JobPost, 'payAmount' | 'payPeriod'>, t: (key: string) => string): string {
  return `${formatRupees(post.payAmount)} / ${t(`jobPost.per.${post.payPeriod}`)}`;
}

/** What the post is for: the person's own words for "other", else the category's name. */
export function jobTitle(post: Pick<JobPost, 'category' | 'title'>, t: (key: string) => string): string {
  return post.category === 'other' ? post.title : t(`jobPost.categories.${post.category}`);
}

export function categoryIcon(category: string): string {
  return JOB_CATEGORIES.find((entry) => entry.key === category)?.icon ?? 'user-tie';
}

/**
 * The partner's own job post as a card: with no post, an invitation to create one; with a post,
 * its title, category, pay and a Live / Hidden pill. Tapping opens the post screen.
 */
export function JobPostCard({
  post,
  name,
  onPress,
}: {
  post: JobPost | null | undefined;
  /** The poster's name, shown above the work (Profile tab). */
  name?: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const live = post?.isActive ?? false;

  return (
    <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress}>
      {post?.photoUrl ? (
        <SmartImage source={{ uri: post.photoUrl }} style={styles.photo} />
      ) : (
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
          <FontAwesome6 name={(post ? categoryIcon(post.category) : 'user-tie') as never} size={20} color="#FFFFFF" solid />
        </LinearGradient>
      )}
      <View style={styles.text}>
        {post ? (
          <>
            {name ? (
              <>
                <Text style={[styles.caption, { color: colors.primary }]}>{t('jobPost.cardCaption')}</Text>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={[styles.meta, { color: colors.text }]} numberOfLines={1}>
                  {jobTitle(post, t)}
                </Text>
              </>
            ) : (
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {jobTitle(post, t)}
              </Text>
            )}
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
              {formatPay(post, t)} · {t(`jobPost.availability.${post.availability}`)}
            </Text>
            <View style={[styles.pill, { backgroundColor: `${live ? brandColors.success : colors.textMuted}1A` }]}>
              <View style={[styles.dot, { backgroundColor: live ? brandColors.success : colors.textMuted }]} />
              <Text style={[styles.pillText, { color: live ? brandColors.success : colors.textMuted }]}>
                {t(live ? 'jobPost.statusLive' : 'jobPost.statusHidden')}
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>{t('jobPost.lookingTitle')}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={2}>
              {t('jobPost.lookingSubtitle')}
            </Text>
          </>
        )}
      </View>
      <FontAwesome6 name="chevron-right" size={14} color={colors.textMuted} solid />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  photo: { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  text: { flex: 1, marginRight: 10 },
  caption: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, letterSpacing: 0.3 },
  title: { ...typography.subheading, fontFamily: fonts.semiBold },
  meta: { ...typography.caption, marginTop: 3 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginTop: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11 },
});
