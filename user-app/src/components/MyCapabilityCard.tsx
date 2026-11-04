import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { VerificationBadge } from './VerificationBadge';
import { SmartImage } from './SmartImage';
import { STAR_COLOR } from './RatingStars';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { FullText } from '@/components/FullText';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

export interface CapabilityStat {
  icon: IconName;
  value: string;
  label: string;
  tint: string;
}

interface MyCapabilityCardProps {
  /** Big faded icon behind the card, and the avatar's icon when there's no photo. */
  icon: IconName;
  title: string;
  photoUrl?: string | null;
  verificationStatus: string;
  kinds: string[];
  place?: string | null;
  stats: CapabilityStat[];
  note: string;
}

/**
 * The account's own service or shop (Services / Bazaar tabs, Profile): photo, name and
 * verification, its kinds, three stat tiles (rating, rated jobs / orders, experience /
 * delivery) and the place — one card, a large faded icon behind it. Information only: it is
 * changed in the Partner app (the note at the bottom says so).
 */
export function MyCapabilityCard({ icon, title, photoUrl, verificationStatus, kinds, place, stats, note }: MyCapabilityCardProps) {
  const { colors, isDark } = useThemeColors();
  return (
    <View
      style={[
        styles.card,
        isDark
          ? { backgroundColor: colors.surface, borderColor: colors.border }
          : { backgroundColor: '#FFFFFF', borderColor: `${colors.primary}26`, ...styles.lightShadow },
      ]}
    >
      <View style={styles.watermark} pointerEvents="none">
        <FontAwesome6 name={icon} size={150} color={colors.primary} solid style={{ opacity: isDark ? 0.07 : 0.06 }} />
      </View>

      <View style={styles.head}>
        {photoUrl ? (
          <SmartImage source={{ uri: photoUrl }} style={styles.avatar} />
        ) : (
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <FontAwesome6 name={icon} size={20} color="#FFFFFF" solid />
          </LinearGradient>
        )}
        <View style={styles.headInfo}>
          <FullText style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </FullText>
          <VerificationBadge status={verificationStatus} />
        </View>
      </View>

      {kinds.length ? (
        <View style={styles.chips}>
          {kinds.map((kind) => (
            <View key={kind} style={[styles.chip, { backgroundColor: `${colors.primary}14` }]}>
              <FullText style={[styles.chipText, { color: colors.primary }]} numberOfLines={1}>
                {kind}
              </FullText>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.stats}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={[styles.stat, { backgroundColor: isDark ? colors.background : `${stat.tint}0D`, borderColor: `${stat.tint}2E` }]}
          >
            <View style={styles.statWatermark} pointerEvents="none">
              <FontAwesome6 name={stat.icon} size={44} color={stat.tint} solid style={{ opacity: 0.12 }} />
            </View>
            <FontAwesome6 name={stat.icon} size={13} color={stat.tint} solid />
            <FullText style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {stat.value}
            </FullText>
            <FullText style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>
              {stat.label}
            </FullText>
          </View>
        ))}
      </View>

      {place ? (
        <View style={styles.placeRow}>
          <FontAwesome6 name="location-dot" size={11} color={colors.textMuted} solid />
          <FullText style={[styles.placeText, { color: colors.textMuted }]} numberOfLines={1}>
            {place}
          </FullText>
        </View>
      ) : null}

      <View style={[styles.note, { borderTopColor: colors.border }]}>
        <FontAwesome6 name="circle-info" size={11} color={colors.textMuted} solid />
        <Text style={[styles.noteText, { color: colors.textMuted }]}>{note}</Text>
      </View>
    </View>
  );
}

/** The usual three tiles: rating, how many rated, and one more fact. */
export function ratingStats(
  t: (key: string, options?: Record<string, unknown>) => string,
  average: number | null,
  count: number,
  countLabel: string,
  extra: CapabilityStat,
): CapabilityStat[] {
  return [
    { icon: 'star', value: average != null ? average.toFixed(1) : t('workerReviews.new'), label: t('workerReviews.statRating'), tint: STAR_COLOR },
    { icon: 'circle-check', value: String(count), label: countLabel, tint: brandColors.success },
    extra,
  ];
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 20, overflow: 'hidden' },
  // Light theme only: on Android an elevation shadow shows through a dark card as a grey cast.
  lightShadow: {
    shadowColor: '#0055D3',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  watermark: { position: 'absolute', right: -26, top: -22, transform: [{ rotate: '-14deg' }] },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headInfo: { flex: 1, gap: 4 },
  title: { ...typography.subheading, fontFamily: fonts.semiBold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 12 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 10, gap: 2, overflow: 'hidden' },
  statWatermark: { position: 'absolute', right: -10, bottom: -10, transform: [{ rotate: '-12deg' }] },
  statValue: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22, marginTop: 4, includeFontPadding: false },
  statLabel: { ...typography.caption, fontSize: 11 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  placeText: { ...typography.caption, fontSize: 12, flex: 1 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 10 },
  noteText: { ...typography.caption, fontSize: 11.5, flex: 1 },
});
