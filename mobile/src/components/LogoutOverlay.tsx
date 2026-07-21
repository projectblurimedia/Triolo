import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { fonts, headerGradient, typography } from '@/theme';

const RING_SIZE = 96;
const DOT_SIZE = 10;
const DOT_COUNT = 3;

/**
 * Full-screen overlay shown for the duration of the logout request — rendered at the
 * app root (see App.tsx) so it draws above whichever navigator is mounted. Deliberately
 * a distinct visual moment (three dots orbiting the brand mark, not a spinner reuse) —
 * every other loading affordance in the app is either Button's inline ActivityIndicator
 * or a button-level spinner, and logging out is the one transition where the whole
 * screen is about to change underneath the user, so it gets its own full-screen beat.
 */
export function LogoutOverlay() {
  const { t } = useTranslation();
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const rotateLoop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    rotateLoop.start();
    pulseLoop.start();
    return () => {
      rotateLoop.stop();
      pulseLoop.stop();
    };
  }, [rotation, pulse]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const markScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <View style={styles.ring}>
          <Animated.View style={[styles.orbit, { transform: [{ rotate: spin }] }]}>
            {Array.from({ length: DOT_COUNT }).map((_, index) => {
              const angle = (360 / DOT_COUNT) * index;
              return (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      transform: [
                        { rotate: `${angle}deg` },
                        { translateY: -(RING_SIZE / 2) },
                      ],
                    },
                  ]}
                />
              );
            })}
          </Animated.View>
          <Animated.View style={[styles.mark, { transform: [{ scale: markScale }] }]}>
            <FontAwesome6 name="shapes" size={28} color="#FFFFFF" solid />
          </Animated.View>
        </View>
        <Text style={styles.label}>{t('common.loggingOut')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  orbit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF' },
});
