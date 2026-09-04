import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LoadingIndicator } from './LoadingIndicator';
import { fonts, headerGradient, typography } from '@/theme';

const RING_SIZE = 96;

/**
 * Full-screen overlay shown for the duration of the logout request — rendered at the
 * app root (see App.tsx) so it draws above whichever navigator is mounted. Deliberately
 * a distinct visual moment — every other loading affordance in the app is the smaller
 * inline LoadingIndicator (e.g. Button's loading state), and logging out is the one
 * transition where the whole screen is about to change underneath the user, so it gets
 * its own full-screen beat: the same orbiting-dots motif at a larger scale, plus a
 * pulsing center mark unique to this full-screen variant.
 */
export function LogoutOverlay() {
  const { t } = useTranslation();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulse]);

  const markScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <View style={styles.ring}>
          <View style={styles.orbit}>
            <LoadingIndicator size={RING_SIZE} dotSize={10} color="rgba(255, 255, 255, 0.85)" duration={1800} />
          </View>
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
