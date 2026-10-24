import React, { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * (Copied from user-app — keep in sync.)
 * Triolo Plus's own look: a gold gradient with a gold border and a light streak that sweeps
 * across now and then. Only plan cards use it, so it never looks like anything else.
 */
export const GOLD_GRADIENT = ['#8A5300', '#C2860F', '#F2C14E', '#FFE29A'] as const;
export const GOLD_BORDER = '#F7CF5A';
/** Text and icons on gold. */
export const GOLD_INK = '#3D2500';
export const GOLD_INK_SOFT = 'rgba(61, 37, 0, 0.78)';
/** The plans screen's header and main button (deep enough for white text). */
export const GOLD_HEADER = ['#7A4700', '#B07A0C', '#DCA431'] as const;
export const GOLD_BUTTON = ['#A86A06', '#D99A1E'] as const;
/** Gold for text, icons and borders on the normal background (reads in light and dark). */
export const GOLD_DEEP = '#C08A12';

const STREAK = 70;
const SWEEP_MS = 1300;
const PAUSE_MS = 2600;

/** The moving shine (absolute, under the content). */
export function GoldShine() {
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!width) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 1, duration: SWEEP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(PAUSE_MS),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [width, x]);

  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-STREAK * 2, width + STREAK] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width ? (
        <Animated.View style={[styles.streak, { transform: [{ translateX }, { rotate: '20deg' }] }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** A gold, shining card with a gold border. */
export function GoldCard({ style, children }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <View style={[styles.card, style]}>
      <LinearGradient colors={GOLD_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* A soft glow in one corner gives it depth. */}
      <View style={styles.glow} />
      <GoldShine />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: GOLD_BORDER,
    overflow: 'hidden',
    shadowColor: '#B7791F',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    right: -50,
    top: -70,
    backgroundColor: 'rgba(255, 246, 214, 0.35)',
  },
  streak: { position: 'absolute', top: -40, bottom: -40, width: STREAK },
});
