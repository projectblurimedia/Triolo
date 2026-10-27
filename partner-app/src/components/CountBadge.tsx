import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors as brandColors, fonts } from '@/theme';

/**
 * A count in a small red pill with white text, like a notification badge — on the tab bar's
 * Bookings icon, Home's side switch and Bookings' switches. Nothing when 0. (A copy of the
 * customer app's CountBadge — keep the two in sync.)
 */
export function CountBadge({ count, style }: { count: number; style?: StyleProp<ViewStyle> }) {
  if (count <= 0) return null;
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.text} numberOfLines={1}>
        {count > 9 ? '9+' : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: brandColors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  text: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 10, lineHeight: 12, includeFontPadding: false, textAlignVertical: 'center', textAlign: 'center' },
});
