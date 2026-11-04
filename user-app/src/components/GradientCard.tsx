import React, { PropsWithChildren } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { fonts, typography, useThemeColors } from '@/theme';
import { FullText } from '@/components/FullText';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

interface GradientCardProps {
  title: string;
  icon: IconName;
  /** A small white pill on the right of the header (View all, Edit). */
  action?: { label: string; icon?: IconName; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}

/**
 * A Profile section card: a deep-blue gradient header with the title (and an action) in white,
 * two soft light circles in it, and the content below on the app background. The same header
 * look as the nearby cards' covers. (Copied between user-app and partner-app — keep in sync.)
 */
export function GradientCard({ title, icon, action, style, children }: PropsWithChildren<GradientCardProps>) {
  const { colors, isDark } = useThemeColors();
  return (
    <View
      style={[
        styles.card,
        isDark
          ? { backgroundColor: colors.background, borderColor: colors.border }
          : { backgroundColor: colors.background, borderColor: `${colors.primary}26`, ...styles.lightShadow },
        style,
      ]}
    >
      <View style={styles.head}>
        <LinearGradient colors={['#0A3FAE', '#0055D3', '#2B83FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.glow, styles.glowLarge]} />
        <View style={[styles.glow, styles.glowSmall]} />
        <View style={styles.headIcon}>
          <FontAwesome6 name={icon} size={12} color="#FFFFFF" solid />
        </View>
        <FullText style={styles.title} numberOfLines={1}>
          {title}
        </FullText>
        {action ? (
          <Pressable
            onPress={action.onPress}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, { opacity: pressed ? 0.75 : 1 }]}
          >
            {action.icon ? <FontAwesome6 name={action.icon} size={9} color="#0055D3" solid /> : null}
            <Text style={styles.actionText}>{action.label}</Text>
            {action.icon ? null : <FontAwesome6 name="chevron-right" size={8} color="#0055D3" solid />}
          </Pressable>
        ) : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

/** One account detail inside a GradientCard: a tinted icon, then the label over its value, all left-aligned. */
export function DetailRow({ icon, label, value, first }: { icon: IconName; label: string; value: string; first?: boolean }) {
  const { colors } = useThemeColors();
  return (
    <View style={[styles.row, first ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: `${colors.primary}14` }]}>
        <FontAwesome6 name={icon} size={12} color={colors.primary} solid />
      </View>
      <View style={styles.rowText}>
        <FullText style={[styles.rowLabel, { color: colors.textMuted }]} numberOfLines={1}>
          {label}
        </FullText>
        <FullText style={[styles.rowValue, { color: colors.text }]} numberOfLines={1}>
          {value}
        </FullText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { ...typography.caption, fontSize: 11, lineHeight: 15, includeFontPadding: false },
  rowValue: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 19, includeFontPadding: false },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  // Light theme only: on Android an elevation shadow shows through a dark card as a grey cast.
  lightShadow: { shadowColor: '#0055D3', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, height: 46, overflow: 'hidden' },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  glowLarge: { width: 90, height: 90, top: -48, right: 40 },
  glowSmall: { width: 46, height: 46, bottom: -26, left: 70 },
  headIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF', flex: 1, includeFontPadding: false },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
  actionText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5, lineHeight: 15, color: '#0055D3', includeFontPadding: false },
  body: { padding: 12 },
});
