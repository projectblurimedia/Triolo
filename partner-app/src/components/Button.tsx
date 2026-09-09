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
  gradient?: readonly [string, string, ...string[]];
}

export function Button({ label, onPress, loading, disabled, gradient }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable onPress={onPress} disabled={isDisabled} style={isDisabled ? styles.disabled : undefined}>
      <LinearGradient
        colors={gradient ?? headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.button}
      >
        {loading ? <LoadingIndicator color={colors.white} /> : <Text style={styles.label}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    // A fixed height (rather than paddingVertical sized to content) so the button is
    // exactly the same height whether it's rendering its label Text or a LoadingIndicator —
    // the two have slightly different natural heights, which otherwise made adjacent
    // buttons (e.g. PhoneVerification's Confirm OTP/Change Number pair) visibly mismatch
    // whenever one was loading and the other wasn't. 48 matches the prior
    // paddingVertical:14 + ~20px text line height almost exactly, so normal buttons look
    // unchanged.
    height: 48,
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
