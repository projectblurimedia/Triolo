import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
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

interface WorkerProfileFactsProps {
  skills: string[];
  ratingAverage: number | null;
  ratingCount: number;
  experienceYears: number;
  /** Shown at the top of the card, above the tiles (e.g. the name and the Trusted badge). */
  badge?: ReactNode;
}

/**
 * The worker's key facts under the profile header: approval badge, three tiles (rating, rated
 * jobs, experience) and their skills as chips.
 */
export function WorkerProfileFacts({ skills, ratingAverage, ratingCount, experienceYears, badge }: WorkerProfileFactsProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

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
    <View style={styles.facts}>
      {/* One card: who it is on top, then rating / rated jobs / experience. */}
      <View style={[styles.factsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {badge ? (
          <View
            style={[styles.factsBadge, { backgroundColor: `${colors.primary}0A`, borderBottomColor: colors.border }]}
          >
            {badge}
          </View>
        ) : null}
        <View style={styles.factsTiles}>
        {tiles.map((tile, index) => (
          <View
            key={tile.label}
            style={[
              styles.factsTile,
              index > 0 ? { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border } : null,
            ]}
          >
            <View style={[styles.factsIcon, { backgroundColor: tile.gold ? `${STAR_GOLD}22` : `${colors.primary}14` }]}>
              <FontAwesome6 name={tile.icon} size={13} color={tile.gold ? STAR_GOLD : colors.primary} solid />
            </View>
            <Text style={[styles.factsValue, { color: colors.text }]} numberOfLines={1}>
              {tile.value}
            </Text>
            <Text style={[styles.factsLabel, { color: colors.textMuted }]} numberOfLines={1}>
              {tile.label}
            </Text>
          </View>
        ))}
        </View>
      </View>
      {skills.length > 0 ? (
        <View style={styles.factsSkills}>
          {skills.map((label) => (
            <View
              key={label}
              style={[styles.factsSkill, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}33` }]}
            >
              <Text style={[styles.factsSkillText, { color: colors.primary }]}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface WorkerReviewsSectionProps {
  summary: WorkerReviewsSummary | undefined;
  loading: boolean;
  error: boolean;
  /** Heading override, e.g. for a shop's reviews. */
  title?: string;
}

export function WorkerReviewsSection({ summary, loading, error, title }: WorkerReviewsSectionProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useThemeColors();
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
          <View style={[styles.card, styles.reviewList, cardStyle]}>
            {summary.reviews.map((review, index) => (
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
  facts: { gap: 12, marginBottom: 6 },
  factsCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0B2A5B',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  factsBadge: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  factsTiles: { flexDirection: 'row', paddingVertical: 14 },
  factsTile: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  factsIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  factsValue: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 21 },
  factsLabel: { ...typography.caption, fontSize: 11 },
  factsSkills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  factsSkill: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  factsSkillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5 },
  flex: { flex: 1 },
  starsRow: { flexDirection: 'row', gap: 3 },
  hero: { borderRadius: 26, paddingHorizontal: 18, paddingBottom: 18, alignItems: 'center', overflow: 'hidden' },
  heroTopRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  blobOne: { width: 220, height: 220, top: -90, right: -70 },
  blobTwo: { width: 160, height: 160, bottom: -70, left: -50, backgroundColor: 'rgba(255,255,255,0.10)' },
  avatarRing: { padding: 4, borderRadius: 52, backgroundColor: GLASS_FILL, borderWidth: 1, borderColor: GLASS_BORDER },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.semiBold, fontSize: 30, lineHeight: 38, color: '#FFFFFF' },
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
