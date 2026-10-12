import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { fonts, typography, useThemeColors } from '@/theme';

export const STAR_COLOR = '#FBBF24';

interface RatingStarsProps {
  average: number | null;
  count: number;
  /** 'compact' = one star + "4.5 (12)"; 'full' = five stars + "4.5 · 12 ratings". */
  variant?: 'compact' | 'full';
}

/** A worker's customer rating, or a "New" pill before their first rating. */
export function RatingStars({ average, count, variant = 'compact' }: RatingStarsProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  if (average == null || count === 0) {
    return (
      <View style={[styles.newPill, { backgroundColor: `${colors.primary}14` }]}>
        <Text style={[styles.newText, { color: colors.primary }]}>{t('rating.new')}</Text>
      </View>
    );
  }

  if (variant === 'compact') {
    return (
      <View style={styles.row}>
        <FontAwesome6 name="star" size={12} color={STAR_COLOR} solid />
        <Text style={[styles.value, { color: colors.text }]}>{average.toFixed(1)}</Text>
        <Text style={[styles.count, { color: colors.textMuted }]}>({count})</Text>
      </View>
    );
  }

  const rounded = Math.round(average);
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <FontAwesome6 key={star} name="star" size={15} color={star <= rounded ? STAR_COLOR : colors.border} solid />
      ))}
      <Text style={[styles.value, styles.fullValue, { color: colors.text }]}>{average.toFixed(1)}</Text>
      <Text style={[styles.count, { color: colors.textMuted }]}>· {t('rating.count', { count })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  value: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  fullValue: { fontSize: 14, marginLeft: 4 },
  count: { ...typography.caption, fontSize: 12 },
  newPill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  newText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10 },
});
