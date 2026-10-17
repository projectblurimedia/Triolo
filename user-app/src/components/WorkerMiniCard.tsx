import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RatingStars } from './RatingStars';
import { WorkerNearbyResult } from '@/services/workersService';
import { formatDistanceValue } from '@/utils/nearbyResult';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { SmartImage } from './SmartImage';

export const MINI_CARD_WIDTH = 168;

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

/** Round photo, or brand-gradient initials when there's no photo. */
export function Avatar({ photoUrl, name, size }: { photoUrl?: string; name: string; size: number }) {
  if (photoUrl) {
    return <SmartImage source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <LinearGradient
      colors={headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.avatarInitials, { fontSize: size * 0.36 }]}>{initialsOf(name)}</Text>
    </LinearGradient>
  );
}

/** Compact worker card for horizontal carousels (Home, Services). */
export function WorkerMiniCard({ worker, onPress }: { worker: WorkerNearbyResult; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const skills = worker.skillCategories
    .filter((key) => key !== 'other')
    .map((key) => t(`workerProfile.skills.${key}`))
    .join(', ');

  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Avatar photoUrl={worker.profilePhotoUrl ?? worker.portfolioPhotoUrls[0]} name={worker.accountFullName} size={56} />
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {worker.accountFullName}
      </Text>
      <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
        {skills}
      </Text>
      <RatingStars average={worker.ratingAverage} count={worker.ratingCount} />
      <View style={styles.meta}>
        <FontAwesome6 name="location-arrow" size={10} color={colors.primary} solid />
        <Text style={[styles.metaStrong, { color: colors.primary }]}>{formatDistanceValue(worker.distanceMeters)}</Text>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          · {t('services.experienceShort', { count: worker.experienceYears })}
        </Text>
      </View>
    </Pressable>
  );
}

export const miniCardStyles = StyleSheet.create({
  card: { width: MINI_CARD_WIDTH, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 5 },
  name: { ...typography.body, fontFamily: fonts.semiBold, marginTop: 4, textAlign: 'center' },
  sub: { ...typography.caption, fontSize: 11, textAlign: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaStrong: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11 },
  metaText: { ...typography.caption, fontSize: 11 },
});

const styles = StyleSheet.create({
  ...miniCardStyles,
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#FFFFFF', fontFamily: fonts.semiBold },
});
