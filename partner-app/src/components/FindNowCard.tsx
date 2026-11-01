import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LoadingIndicator } from './LoadingIndicator';
import { colors as brandColors, fonts, headerGradient, typography } from '@/theme';

/**
 * Home's "Find Jobs Now" / "Find Orders Now": one blue gradient card that carries its own
 * small title ("FIND WORK NEAR YOU"), the action, a one-line hint and a pulsing search icon —
 * no separate section heading above it.
 */
export function FindNowCard({
  eyebrow,
  title,
  hint,
  busy,
  onPress,
}: {
  eyebrow: string;
  title: string;
  hint: string;
  busy: boolean;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.shadow, { transform: [{ scale: pressed ? 0.985 : 1 }] }]}
    >
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        {/* Soft circles and a large faded icon, for depth. */}
        <View style={[styles.bubble, styles.bubbleBig]} />
        <View style={[styles.bubble, styles.bubbleSmall]} />
        <FontAwesome6 name="magnifying-glass-location" size={96} color="rgba(255,255,255,0.08)" solid style={styles.watermark} />

        <View style={styles.eyebrowRow}>
          <View style={[styles.liveDot, { backgroundColor: brandColors.success }]} />
          <Text style={styles.eyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
        </View>

        <View style={styles.row}>
          <View style={styles.iconSpot}>
            {busy ? null : <Animated.View style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />}
            <View style={styles.icon}>
              {busy ? (
                <LoadingIndicator size={22} dotSize={4} color={headerGradient[0]} />
              ) : (
                <FontAwesome6 name="magnifying-glass-location" size={20} color={headerGradient[0]} solid />
              )}
            </View>
          </View>
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.hint} numberOfLines={2}>
              {hint}
            </Text>
          </View>
          <View style={styles.go}>
            <FontAwesome6 name="arrow-right" size={14} color={headerGradient[0]} solid />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    marginTop: 18,
    marginBottom: 6,
    borderRadius: 22,
    shadowColor: '#0B3A8A',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  card: { borderRadius: 22, padding: 16, gap: 12, overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  bubbleBig: { width: 160, height: 160, top: -70, right: -40 },
  bubbleSmall: { width: 90, height: 90, bottom: -45, left: -25 },
  watermark: { position: 'absolute', right: 14, bottom: -18 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  eyebrow: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.semiBold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconSpot: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#FFFFFF' },
  icon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 18, lineHeight: 24 },
  hint: { ...typography.caption, color: 'rgba(255,255,255,0.85)', fontSize: 12.5, lineHeight: 17 },
  go: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
