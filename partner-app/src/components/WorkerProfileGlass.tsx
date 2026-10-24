import React, { ReactNode, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LoadingIndicator } from './LoadingIndicator';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { WorkerReviewsSummary } from '@/services/reviewsService';

/**
 * The worker profile's glassy look, shared by partner-app (the worker's own Profile tab)
 * and user-app (a worker's profile as a customer sees it). Copied in both apps — keep the
 * two in sync.
 *
 *  - WorkerProfileHero: brand gradient with soft light blobs, avatar, name, skills, and three
 *    frosted-glass stat tiles (rating, rated jobs, experience).
 *  - WorkerReviewsSection: big average with stars, a 5→1 star breakdown, and the customers'
 *    written reviews.
 */

const STAR_GOLD = '#FBBF24';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Manual, not toLocale* — Hermes on Android doesn't reliably ship full Intl data.
function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Stars({
  value,
  size,
  color = STAR_GOLD,
  emptyColor,
}: {
  value: number;
  size: number;
  color?: string;
  emptyColor: string;
}) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => {
        const full = value >= star;
        const half = !full && value >= star - 0.5;
        return (
          <FontAwesome6
            key={star}
            name={half ? 'star-half-stroke' : 'star'}
            size={size}
            color={full || half ? color : emptyColor}
            solid={full || half}
          />
        );
      })}
    </View>
  );
}

interface WorkerProfileHeroProps {
  name: string;
  skills: string[];
  ratingAverage: number | null;
  ratingCount: number;
  experienceYears: number;
  /** Small line under the name, e.g. "1.2 km away" or "Your worker profile". */
  subtitle?: string;
  /** Rendered under the skills, e.g. a VerificationBadge. */
  badge?: ReactNode;
  /** Extra top padding when the hero sits under the status bar. */
  topInset?: number;
  /** Rendered in the hero's top row, e.g. a back button. */
  topLeft?: ReactNode;
  /** Rendered at the right of that top row, e.g. a favorite heart. */
  topRight?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function WorkerProfileHero({
  name,
  skills,
  ratingAverage,
  ratingCount,
  experienceYears,
  subtitle,
  badge,
  topInset = 0,
  topLeft,
  topRight,
  style,
}: WorkerProfileHeroProps) {
  const { t } = useTranslation();

  const tiles: { icon: React.ComponentProps<typeof FontAwesome6>['name']; value: string; label: string; gold?: boolean }[] = [
    {
      icon: 'star',
      value: ratingAverage != null ? ratingAverage.toFixed(1) : t('workerReviews.new'),
      label: t('workerReviews.statRating'),
      gold: true,
    },
    { icon: 'circle-check', value: String(ratingCount), label: t('workerReviews.statRatedJobs') },
    {
      icon: 'briefcase',
      value: t('workerReviews.experienceValue', { count: experienceYears }),
      label: t('workerReviews.statExperience'),
    },
  ];

  return (
    <LinearGradient
      colors={headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { paddingTop: topInset + 16 }, style]}
    >
      {/* Soft light blobs behind the content — what makes the frosted tiles read as glass. */}
      <View style={[styles.blob, styles.blobOne]} />
      <View style={[styles.blob, styles.blobTwo]} />

      {topLeft || topRight ? (
        <View style={styles.heroTopRow}>
          {topLeft ?? <View />}
          {topRight ?? null}
        </View>
      ) : null}

      <View style={styles.avatarRing}>
        <LinearGradient colors={['#FFFFFF', '#DCEBFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(name)}</Text>
        </LinearGradient>
      </View>
      <Text style={styles.heroName} numberOfLines={1}>
        {name}
      </Text>
      {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
      {skills.length > 0 ? (
        <View style={styles.heroSkills}>
          {skills.map((label) => (
            <View key={label} style={styles.glassChip}>
              <Text style={styles.glassChipText}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {badge ? <View style={styles.heroBadge}>{badge}</View> : null}

      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <View key={tile.label} style={styles.glassTile}>
            <View style={styles.tileValueRow}>
              <FontAwesome6 name={tile.icon} size={13} color={tile.gold ? STAR_GOLD : '#FFFFFF'} solid />
              <Text style={styles.tileValue} numberOfLines={1}>
                {tile.value}
              </Text>
            </View>
            <Text style={styles.tileLabel} numberOfLines={1}>
              {tile.label}
            </Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

interface WorkerReviewsSectionProps {
  summary: WorkerReviewsSummary | undefined;
  loading: boolean;
  error: boolean;
  /** Heading override, e.g. for a shop's reviews. */
  title?: string;
}

type ReviewSort = 'newest' | 'high' | 'low';
const REVIEWS_SHOWN = 3;

export function WorkerReviewsSection({ summary, loading, error, title }: WorkerReviewsSectionProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useThemeColors();
  // The written reviews: newest first, or by stars high → low / low → high; three, then Show more.
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [showAll, setShowAll] = useState(false);
  // Flat and clean: one surface colour, a hairline border, no shadows.
  const cardStyle = { backgroundColor: colors.surface, borderColor: colors.border };
  const trackColor = isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F8';

  if (loading || error || !summary) {
    return (
      <View style={[styles.card, styles.center, cardStyle, styles.sectionGap]}>
        {loading ? (
          <LoadingIndicator size={28} dotSize={4} color={colors.primary} />
        ) : (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('workerReviews.loadFailed')}</Text>
        )}
      </View>
    );
  }

  const totalRated = summary.distribution.reduce((sum, count) => sum + count, 0);
  const sorted = [...summary.reviews].sort((a, b) => {
    if (sort === 'high') return (b.rating ?? 0) - (a.rating ?? 0) || b.completedAt.localeCompare(a.completedAt);
    if (sort === 'low') return (a.rating ?? 0) - (b.rating ?? 0) || b.completedAt.localeCompare(a.completedAt);
    return b.completedAt.localeCompare(a.completedAt);
  });
  const visibleReviews = showAll ? sorted : sorted.slice(0, REVIEWS_SHOWN);
  const hiddenCount = sorted.length - visibleReviews.length;
  const sortOptions: { key: ReviewSort; label: string; icon: React.ComponentProps<typeof FontAwesome6>['name'] }[] = [
    { key: 'newest', label: t('workerReviews.sortNewest'), icon: 'clock' },
    { key: 'high', label: t('workerReviews.sortHigh'), icon: 'arrow-down-wide-short' },
    { key: 'low', label: t('workerReviews.sortLow'), icon: 'arrow-up-short-wide' },
  ];
  const average = summary.ratingAverage ?? 0;

  return (
    <View style={styles.sectionGap}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title ?? t('workerReviews.title')}</Text>

      <View style={[styles.card, styles.summaryCard, cardStyle]}>
        <View style={styles.summaryLeft}>
          <Text style={[styles.bigAverage, { color: colors.text }]}>
            {summary.ratingAverage != null ? average.toFixed(1) : '–'}
          </Text>
          <Stars value={average} size={13} emptyColor={colors.border} />
          <Text style={[styles.ratingCount, { color: colors.textMuted }]}>
            {summary.ratingCount > 0
              ? t('workerReviews.ratingsCount', { count: summary.ratingCount })
              : t('workerReviews.noRatings')}
          </Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryRight}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.distribution[star - 1];
            const share = totalRated > 0 ? count / totalRated : 0;
            return (
              <View key={star} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: colors.textMuted }]}>{star}</Text>
                <View style={[styles.barTrack, { backgroundColor: trackColor }]}>
                  {share > 0 ? <View style={[styles.barFill, { width: `${Math.max(share * 100, 5)}%` }]} /> : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {summary.reviews.length > 0 ? (
        <>
          <Text style={[styles.subTitle, { color: colors.text }]}>{t('workerReviews.whatCustomersSay')}</Text>
          {summary.reviews.length > 1 ? (
            <View style={[styles.sortRow, { backgroundColor: colors.surface, borderColor: `${colors.primary}26` }]}>
              {sortOptions.map((option) => {
                const active = sort === option.key;
                return (
                  <Pressable key={option.key} style={styles.sortItem} onPress={() => setSort(option.key)}>
                    {active ? (
                      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sortFill}>
                        <FontAwesome6 name={option.icon} size={10} color="#FFFFFF" solid />
                        <Text style={[styles.sortText, { color: '#FFFFFF' }]} numberOfLines={1}>
                          {option.label}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.sortFill}>
                        <FontAwesome6 name={option.icon} size={10} color={colors.textMuted} solid />
                        <Text style={[styles.sortText, { color: colors.text }]} numberOfLines={1}>
                          {option.label}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <View style={[styles.card, styles.reviewList, cardStyle]}>
            {visibleReviews.map((review, index) => (
              <View
                key={`${review.completedAt}-${index}`}
                style={[
                  styles.reviewRow,
                  index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
                ]}
              >
                <View style={styles.reviewHeader}>
                  <View style={[styles.reviewAvatar, { backgroundColor: `${colors.primary}14` }]}>
                    <Text style={[styles.reviewAvatarText, { color: colors.primary }]}>{initialsOf(review.customerName)}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.reviewName, { color: colors.text }]} numberOfLines={1}>
                      {review.customerName}
                    </Text>
                    {review.rating ? <Stars value={review.rating} size={11} emptyColor={colors.border} /> : null}
                  </View>
                  <Text style={[styles.reviewDate, { color: colors.textMuted }]}>{formatDate(review.completedAt)}</Text>
                </View>
                {review.review ? <Text style={[styles.reviewText, { color: colors.text }]}>{review.review}</Text> : null}
                {review.skillCategories.length > 0 ? (
                  <Text style={[styles.reviewSkills, { color: colors.textMuted }]} numberOfLines={1}>
                    {review.skillCategories.map((key) => t(`workerProfile.skills.${key}`)).join(' · ')}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
          {hiddenCount > 0 || showAll ? (
            <Pressable
              onPress={() => setShowAll((on) => !on)}
              style={({ pressed }) => [styles.moreButton, { borderColor: `${colors.primary}40`, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.moreText, { color: colors.primary }]}>
                {showAll ? t('workerReviews.showLess') : t('workerReviews.showMore', { count: hiddenCount })}
              </Text>
              <FontAwesome6 name={showAll ? 'chevron-up' : 'chevron-down'} size={11} color={colors.primary} solid />
            </Pressable>
          ) : null}
        </>
      ) : (
        <View style={[styles.card, styles.center, cardStyle, styles.emptyGap]}>
          <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}14` }]}>
            <FontAwesome6 name="comment-dots" size={18} color={colors.primary} solid />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('workerReviews.noReviewsTitle')}</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('workerReviews.noReviewsMessage')}</Text>
        </View>
      )}
    </View>
  );
}

const GLASS_FILL = 'rgba(255,255,255,0.16)';
const GLASS_BORDER = 'rgba(255,255,255,0.32)';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  starsRow: { flexDirection: 'row', gap: 3 },
  hero: { borderRadius: 26, paddingHorizontal: 18, paddingBottom: 18, alignItems: 'center', overflow: 'hidden' },
  heroTopRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  blobOne: { width: 220, height: 220, top: -90, right: -70 },
  blobTwo: { width: 160, height: 160, bottom: -70, left: -50, backgroundColor: 'rgba(255,255,255,0.10)' },
  avatarRing: { padding: 4, borderRadius: 52, backgroundColor: GLASS_FILL, borderWidth: 1, borderColor: GLASS_BORDER },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.semiBold, fontSize: 30, lineHeight: 38, color: '#0055D3' },
  heroName: { fontFamily: fonts.semiBold, fontSize: 21, lineHeight: 28, color: '#FFFFFF', marginTop: 12 },
  heroSubtitle: { ...typography.caption, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  heroSkills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 10 },
  glassChip: {
    backgroundColor: GLASS_FILL,
    borderColor: GLASS_BORDER,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  glassChipText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 12, color: '#FFFFFF' },
  heroBadge: { marginTop: 10 },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 16, alignSelf: 'stretch' },
  glassTile: {
    flex: 1,
    backgroundColor: GLASS_FILL,
    borderColor: GLASS_BORDER,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  tileValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tileValue: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 22, color: '#FFFFFF' },
  tileLabel: { ...typography.caption, fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  sectionGap: { marginTop: 22 },
  sectionTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginBottom: 12 },
  subTitle: { ...typography.body, fontFamily: fonts.semiBold, marginTop: 20, marginBottom: 10 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 26 },
  summaryCard: { flexDirection: 'row', alignItems: 'center' },
  summaryLeft: { alignItems: 'center', gap: 4, width: 104 },
  bigAverage: { fontFamily: fonts.semiBold, fontSize: 38, lineHeight: 46 },
  ratingCount: { ...typography.caption, fontSize: 11, textAlign: 'center' },
  summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 14 },
  summaryRight: { flex: 1, gap: 7 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { fontFamily: fonts.medium, fontSize: 12, width: 10, textAlign: 'right' },
  barTrack: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4, backgroundColor: STAR_GOLD },
  reviewList: { paddingVertical: 4 },
  sortRow: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 3, marginBottom: 10 },
  sortItem: { flex: 1 },
  sortFill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 32, borderRadius: 11, paddingHorizontal: 4 },
  sortText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5, lineHeight: 15 },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    marginTop: 12,
  },
  moreText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13.5 },
  reviewRow: { paddingVertical: 14, gap: 8 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reviewAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { fontFamily: fonts.semiBold, fontSize: 14 },
  reviewName: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15, marginBottom: 2 },
  reviewDate: { ...typography.caption, fontSize: 11, alignSelf: 'flex-start', marginTop: 2 },
  reviewText: { ...typography.body, fontSize: 14, lineHeight: 21 },
  reviewSkills: { ...typography.caption, fontSize: 12 },
  emptyGap: { marginTop: 14 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { ...typography.body, fontFamily: fonts.semiBold },
  emptyText: { ...typography.caption, textAlign: 'center', lineHeight: 18 },
});
