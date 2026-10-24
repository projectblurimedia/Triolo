import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { fonts, headerGradient, typography } from '@/theme';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

interface NearbyHeroProps {
  icon: IconName;
  title: string;
  subtitle: string;
  /** The big number on the right; nothing while still counting. */
  count?: number | null;
  /** Under the number, e.g. "nearby now". */
  countCaption: string;
  /** Tapping the card: the full list. */
  onPress?: () => void;
  /** "See all" on the card. */
  seeAllLabel?: string;
  /** A button inside the card (Bazaar: Send your list). */
  action?: { label: string; icon: IconName; onPress: () => void };
}

/**
 * The top of the Services and Bazaar tabs: a blue card saying what the tab is ("Workers near
 * you"), how many there are right now in big numbers, and a short line under it. Tapping it
 * lists them all; it can carry one button of its own.
 */
export function NearbyHero({ icon, title, subtitle, count, countCaption, onPress, seeAllLabel, action }: NearbyHeroProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.press, { opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }]}
    >
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={[styles.blob, styles.blobOne]} />
        <View style={[styles.blob, styles.blobTwo]} />
        <View style={styles.row}>
          <View style={styles.icon}>
            <FontAwesome6 name={icon} size={20} color="#FFFFFF" solid />
          </View>
          <View style={styles.flex}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.caption} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
          {count != null ? (
            <View style={styles.countWrap}>
              <Text style={styles.count}>{count}</Text>
              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{countCaption}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {action || (onPress && seeAllLabel) ? (
          <View style={styles.footer}>
            {action ? (
              <Pressable onPress={action.onPress} accessibilityRole="button" style={({ pressed }) => [styles.action, { opacity: pressed ? 0.85 : 1 }]}>
                <FontAwesome6 name={action.icon} size={13} color="#0055D3" solid />
                <Text style={styles.actionText}>{action.label}</Text>
              </Pressable>
            ) : (
              <View />
            )}
            {onPress && seeAllLabel ? (
              <View style={styles.seeAll}>
                <Text style={styles.seeAllText}>{seeAllLabel}</Text>
                <FontAwesome6 name="chevron-right" size={11} color="#FFFFFF" solid />
              </View>
            ) : null}
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { marginBottom: 14, borderRadius: 22 },
  card: { borderRadius: 22, padding: 18, overflow: 'hidden', gap: 14 },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  blobOne: { width: 150, height: 150, top: -70, right: -40 },
  blobTwo: { width: 90, height: 90, bottom: -45, left: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flex: { flex: 1 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', lineHeight: 22 },
  caption: { ...typography.caption, fontSize: 12.5, color: 'rgba(255,255,255,0.88)', marginTop: 2, lineHeight: 17 },
  countWrap: { alignItems: 'flex-end' },
  count: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 34, lineHeight: 40, includeFontPadding: false },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  liveText: { color: 'rgba(255,255,255,0.88)', fontFamily: fonts.medium, fontSize: 11 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  actionText: { color: '#0055D3', fontFamily: fonts.semiBold, fontSize: 13, includeFontPadding: false },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seeAllText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 12.5 },
});
