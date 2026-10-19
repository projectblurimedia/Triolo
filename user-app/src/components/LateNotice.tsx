import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';

/** Wait before a worker / shop counts as late: the customer may then cancel and rate them. */
export const LATE_AFTER_MS = 60 * 60 * 1000;

/** The current time, refreshed every `everyMs` — so "late" appears without reopening the screen. */
export function useNow(everyMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/**
 * "Still waiting?" — shown on a booking or order that's over an hour late, with the way out:
 * cancel it and rate the worker / shop.
 */
export function LateNotice({
  title,
  message,
  actionLabel,
  onPress,
}: {
  title: string;
  message: string;
  actionLabel: string;
  onPress: () => void;
}) {
  const { colors } = useThemeColors();
  return (
    <View style={[styles.card, { backgroundColor: `${brandColors.warning}12`, borderColor: `${brandColors.warning}44` }]}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: brandColors.warning }]}>
          <FontAwesome6 name="clock" size={15} color="#FFFFFF" solid />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
        </View>
      </View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.action, { borderColor: brandColors.error, opacity: pressed ? 0.8 : 1 }]}
        accessibilityRole="button"
      >
        <FontAwesome6 name="star-half-stroke" size={13} color={brandColors.error} solid />
        <Text style={[styles.actionText, { color: brandColors.error }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.body, fontFamily: fonts.semiBold },
  message: { ...typography.caption, lineHeight: 18, marginTop: 2 },
  action: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: { ...typography.body, fontFamily: fonts.semiBold },
});
