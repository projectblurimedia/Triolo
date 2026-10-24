import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

/** "Delivery" on / off beside a category dropdown — the same height as its field. */
export function DeliveryToggle({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  const { colors } = useThemeColors();
  const content = (
    <>
      <FontAwesome6 name="truck" size={13} color={on ? '#FFFFFF' : colors.primary} solid />
      <Text style={[styles.label, { color: on ? '#FFFFFF' : colors.text }]}>{label}</Text>
    </>
  );
  return (
    <Pressable onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }}>
      {on ? (
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.toggle}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.toggle, styles.off, { borderColor: colors.border, backgroundColor: colors.surface }]}>{content}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: { height: 50, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  off: { borderWidth: 1.5 },
  label: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13 },
});
