import React, { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '@/theme';

interface ScreenContainerProps {
  /**
   * Which edges to pad. Defaults to all four for standalone screens (e.g. auth).
   * Tab screens sit below a GradientHeader and above the tab bar, both of which
   * already handle their own top/bottom insets — pass edges={['left','right']}
   * there to avoid doubling that padding.
   */
  edges?: Edge[];
}

export function ScreenContainer({ children, edges = ['top', 'right', 'bottom', 'left'] }: PropsWithChildren<ScreenContainerProps>) {
  const { colors } = useThemeColors();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1, padding: 20 },
});
