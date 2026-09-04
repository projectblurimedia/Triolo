import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { fonts, typography, useThemeColors } from '@/theme';

export interface ProfileStat {
  icon: keyof typeof FontAwesome6.glyphMap;
  value: string;
  label: string;
  tint: string;
}

interface ProfileStatsRowProps {
  stats: ProfileStat[];
}

/** Compact stat-tile row (icon badge, big value, small label) shown above a Worker/Business
 * profile card on the Profile tab — one row per capability, since rating and completed-work
 * counts are per-capability (worker_profiles/business_profiles), not per-account. */
export function ProfileStatsRow({ stats }: ProfileStatsRowProps) {
  const { colors } = useThemeColors();

  return (
    <View style={styles.row}>
      {stats.map((stat) => (
        <View key={stat.label} style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconBadge, { backgroundColor: `${stat.tint}16` }]}>
            <FontAwesome6 name={stat.icon} size={14} color={stat.tint} solid />
          </View>
          <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
            {stat.value}
          </Text>
          <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  tile: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14 },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  value: { ...typography.subheading, fontFamily: fonts.semiBold },
  label: { ...typography.caption, marginTop: 2 },
});
