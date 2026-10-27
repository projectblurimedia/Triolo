import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { fonts, typography } from '@/theme';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

/**
 * The top of an Activity side: one headline number in a gradient card (what the partner
 * earned, or how many people visited their job posts) and three small counts under it.
 */
export function ActivitySummary({
  icon,
  label,
  value,
  gradient,
  stats,
}: {
  icon: IconName;
  label: string;
  value: string;
  gradient: readonly [string, string, ...string[]];
  stats: { icon: IconName; value: number; label: string }[];
}) {
  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={[styles.glow, styles.glowOne]} />
      <View style={[styles.glow, styles.glowTwo]} />
      <View style={styles.head}>
        <View style={styles.icon}>
          <FontAwesome6 name={icon} size={16} color="#FFFFFF" solid />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        </View>
      </View>
      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <View style={styles.statTop}>
              <FontAwesome6 name={stat.icon} size={11} color="#FFFFFF" solid />
              <Text style={styles.statValue}>{stat.value}</Text>
            </View>
            <Text style={styles.statLabel} numberOfLines={1}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 20, padding: 14, gap: 12, overflow: 'hidden', marginBottom: 12 },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  glowOne: { width: 160, height: 160, top: -70, right: -40 },
  glowTwo: { width: 90, height: 90, bottom: -45, left: 40, backgroundColor: 'rgba(255,255,255,0.08)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.88)' },
  value: { fontFamily: fonts.semiBold, fontSize: 26, lineHeight: 32, color: '#FFFFFF' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 21, color: '#FFFFFF' },
  statLabel: { ...typography.caption, fontSize: 10.5, color: 'rgba(255,255,255,0.85)' },
});
