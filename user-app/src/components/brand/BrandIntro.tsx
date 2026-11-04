import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BrandMotion } from './BrandMotion';
import { Wordmark } from './Wordmark';

// The icon background (S1). The native splash is the plain first colour, so the hand-over is seamless.
export const BRAND_GRADIENT = ['#0A3FB8', '#1E6BF5', '#4FA3FF'] as const;
// How long the opening shows before it fades away (the motion itself runs ~1.35 s).
const HOLD_MS = 1650;
const FADE_MS = 260;

/**
 * The NearbyU opening animation, over everything, once per launch: the mark builds itself, then
 * the name rises in with నియర్‌బై యు (and a PARTNER tag in the partner app); then it fades away.
 * (Copied between user-app and partner-app — keep in sync; `partner` differs.)
 */
export function BrandIntro({ partner = false, onFinish }: { partner?: boolean; onFinish: () => void }) {
  const { width } = useWindowDimensions();
  const fade = useRef(new Animated.Value(1)).current;
  const word = useRef(new Animated.Value(0)).current;
  const [gone, setGone] = useState(false);

  useEffect(() => {
    Animated.timing(word, { toValue: 1, duration: 400, delay: 810, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
        setGone(true);
        onFinish();
      });
    }, HOLD_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gone) return null;
  const size = Math.min(width * 0.86, 380);
  const rise = { opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] };
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents="none">
      <LinearGradient colors={BRAND_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ marginTop: -size * 0.1 }}>
        <BrandMotion size={size} mode="intro" />
      </View>
      <Animated.View style={[styles.words, { marginTop: -size * 0.17 }, rise]}>
        <Wordmark size={36} />
        <Text style={styles.telugu} allowFontScaling={false}>
          నియర్‌బై యు
        </Text>
        {partner ? (
          <LinearGradient colors={['#FFC93C', '#FF9F1C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.partner}>
            <Text style={styles.partnerText} allowFontScaling={false}>
              PARTNER
            </Text>
          </LinearGradient>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 1000, elevation: 1000, alignItems: 'center', justifyContent: 'center' },
  words: { alignItems: 'center', gap: 6 },
  telugu: { color: 'rgba(255,255,255,0.82)', fontSize: 15, marginTop: 2 },
  partner: { marginTop: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4 },
  partnerText: { color: '#3A2200', fontFamily: 'Poppins_600SemiBold', fontSize: 11, letterSpacing: 2 },
});
