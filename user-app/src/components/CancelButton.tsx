import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';

const RED_GRADIENT = ['#ef4444', '#dc2626'] as const;

interface CancelButtonProps {
  label: string;
  onPress: () => void;
  /** One short line under the button, e.g. until when cancelling is allowed. */
  hint?: string;
  icon?: React.ComponentProps<typeof FontAwesome6>['name'];
}

/**
 * The one way every screen offers "Cancel this job / order / booking": a full-width red pill
 * (tinted fill, solid red rim, a red gradient icon badge) that reads clearly as a real but
 * destructive action — not a faint text link. Identical copies in both apps.
 */
export function CancelButton({ label, onPress, hint, icon = 'xmark' }: CancelButtonProps) {
  const { colors } = useThemeColors();
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: `${brandColors.error}${pressed ? '26' : '12'}`,
            borderColor: `${brandColors.error}${pressed ? 'CC' : '80'}`,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <LinearGradient colors={RED_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
          <FontAwesome6 name={icon} size={13} color="#FFFFFF" solid />
        </LinearGradient>
        <Text style={[styles.label, { color: brandColors.error }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
      {hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18, alignItems: 'stretch' },
  button: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15 },
  hint: { ...typography.caption, fontSize: 11, textAlign: 'center', marginTop: 8 },
});
