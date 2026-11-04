import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { TRUSTED_GRADIENT } from './TrustedBadge';
import { FullText } from '@/components/FullText';

// Rating gold (as RatingStars) for Top rated; Trusted green (as the Trusted seal) for Trusted.
const TONES = {
  blue: { gradient: headerGradient, accent: null },
  gold: { gradient: ['#F5B301', '#FBBF24'] as const, accent: '#D99A00' },
  green: { gradient: TRUSTED_GRADIENT, accent: '#059669' },
};

interface SectionHeaderProps {
  title: string;
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  /** How many are in this row — on the right, inside See all ("See all · 5") or on its own. */
  count?: number;
  tone?: keyof typeof TONES;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The header above a group of cards (the Services / Bazaar category rows, the search result
 * groups): the icon in a gradient square, the name, a thin rule, and on the right the count —
 * inside the See all pill when there is one — so each group reads as its own section.
 */
export function SectionHeader({ title, icon, count, tone = 'blue', onSeeAll, seeAllLabel, style }: SectionHeaderProps) {
  const { colors } = useThemeColors();
  const { gradient, accent: toneAccent } = TONES[tone];
  const accent = toneAccent ?? colors.primary;
  return (
    <View style={[styles.row, style]}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
        <FontAwesome6 name={icon} size={13} color="#FFFFFF" solid />
      </LinearGradient>
      <FullText style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {title}
      </FullText>
      <View style={[styles.rule, { backgroundColor: `${colors.primary}1F` }]} />
      {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.seeAll,
            { borderColor: `${accent}40`, backgroundColor: `${accent}10`, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[styles.seeAllText, { color: accent }]}>{seeAllLabel}</Text>
          {count !== undefined ? (
            <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.seeAllCount}>
              <Text style={styles.seeAllCountText}>{count}</Text>
            </LinearGradient>
          ) : (
            <FontAwesome6 name="chevron-right" size={9} color={accent} solid />
          )}
        </Pressable>
      ) : count !== undefined ? (
        <View style={[styles.count, { backgroundColor: `${accent}18` }]}>
          <Text style={[styles.countText, { color: accent }]}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12 },
  icon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.body, fontFamily: fonts.semiBold, flexShrink: 1 },
  count: { minWidth: 24, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  countText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 14 },
  rule: { flex: 1, height: 1, minWidth: 8 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, borderRadius: 14, borderWidth: 1, paddingLeft: 11, paddingRight: 3 },
  seeAllCount: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  seeAllCountText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 14, color: '#FFFFFF', includeFontPadding: false },
  seeAllText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 16 },
});
