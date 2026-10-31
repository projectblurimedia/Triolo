import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useThemeColors } from '@/theme';

/**
 * What a job / order screen looks like while it loads: its cards as soft grey shapes, gently
 * pulsing — instead of a lone spinner on an empty page. Opacity only, on the native driver.
 */
export function DetailSkeleton() {
  const { colors } = useThemeColors();
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const block = { backgroundColor: `${colors.primary}14` };
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  return (
    <Animated.View style={[styles.wrap, { opacity: pulse }]} accessibilityRole="progressbar">
      {/* Status banner */}
      <View style={[styles.banner, block]} />
      {/* The person: avatar, name, a line */}
      <View style={[card, styles.row]}>
        <View style={[styles.avatar, block]} />
        <View style={styles.flex}>
          <View style={[styles.line, styles.wide, block]} />
          <View style={[styles.line, styles.narrow, block]} />
        </View>
      </View>
      {/* Steps */}
      <View style={card}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={[styles.row, styles.step]}>
            <View style={[styles.dot, block]} />
            <View style={[styles.line, index % 2 ? styles.mid : styles.wide, block]} />
          </View>
        ))}
      </View>
      {/* Details */}
      <View style={card}>
        <View style={[styles.line, styles.mid, block]} />
        <View style={[styles.line, styles.wide, block]} />
        <View style={[styles.line, styles.narrow, block]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 8 },
  wrap: { padding: 20, gap: 14 },
  banner: { height: 84, borderRadius: 18 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: { paddingVertical: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  dot: { width: 20, height: 20, borderRadius: 10 },
  line: { height: 12, borderRadius: 6 },
  wide: { width: '80%' },
  mid: { width: '60%' },
  narrow: { width: '40%' },
});
