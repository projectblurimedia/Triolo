import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LoadingIndicator } from './LoadingIndicator';
import { colors, headerGradient, typography } from '@/theme';

interface ButtonProps {
  label: string;
  /** May return a promise: the button then spins (and ignores taps) until it settles. */
  onPress: () => unknown;
  loading?: boolean;
  disabled?: boolean;
  gradient?: readonly [string, string, ...string[]];
}

export function Button({ label, onPress, loading, disabled, gradient }: ButtonProps) {
  // A tap always shows that something is happening: an async onPress keeps the spinner on
  // until it is done, so there is never a still moment that invites a second tap.
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const busy = loading || pending;
  const isDisabled = disabled || busy;

  const handlePress = () => {
    if (running.current) return;
    const result = onPress();
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      running.current = true;
      setPending(true);
      (result as Promise<unknown>).finally(() => {
        running.current = false;
        setPending(false);
      });
    }
  };

  return (
    <Pressable onPress={handlePress} disabled={isDisabled} style={isDisabled ? styles.disabled : undefined}>
      <LinearGradient
        colors={gradient ?? headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.button}
      >
        {busy ? <LoadingIndicator color={colors.white} /> : <Text style={styles.label}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    // Fixed height so the button is the same size showing its label or the spinner —
    // padding-sized, it changed height while loading and got clipped in button rows.
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
