import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LoadingIndicator } from './LoadingIndicator';
import { colors, headerGradient, typography } from '@/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, loading, disabled }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable onPress={onPress} disabled={isDisabled} style={isDisabled ? styles.disabled : undefined}>
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.button}>
        {loading ? <LoadingIndicator color={colors.white} /> : <Text style={styles.label}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    color: colors.white,
    ...typography.subheading,
  },
});
