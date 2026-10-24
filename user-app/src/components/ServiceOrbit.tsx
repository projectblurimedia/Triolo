import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

// The kinds of help that circle the centre (the same ring as the Welcome screen).
const ORBIT: { icon: IconName; tint: string }[] = [
  { icon: 'bolt', tint: '#F59E0B' },
  { icon: 'faucet', tint: '#0EA5E9' },
  { icon: 'paint-roller', tint: '#EC4899' },
  { icon: 'hammer', tint: '#7C3AED' },
  { icon: 'wrench', tint: '#0055D3' },
  { icon: 'broom', tint: '#14B8A6' },
  { icon: 'car', tint: '#EF4444' },
  { icon: 'trowel-bricks', tint: '#16A34A' },
];
const ORBIT_SECONDS = 26;
const BUBBLE = 40;

interface ServiceOrbitProps {
  size: number;
  centerIcon: IconName;
  title: string;
  text: string;
}

/**
 * A ring of service icons slowly circling a blue badge with a short title — the Welcome
 * screen's look, reused where a screen would otherwise start empty (Quick Book).
 */
export function ServiceOrbit({ size, centerIcon, title, text }: ServiceOrbitProps) {
  const { colors } = useThemeColors();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: ORBIT_SECONDS * 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  // Each icon turns back the other way so it stays upright while it travels round.
  const counterRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const radius = size / 2 - BUBBLE / 2 - 4;

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.ring,
          { width: radius * 2, height: radius * 2, borderRadius: radius, left: size / 2 - radius, top: size / 2 - radius },
          { borderColor: `${colors.primary}30` },
        ]}
      />
      <View
        style={[
          styles.glow,
          { width: size * 0.56, height: size * 0.56, borderRadius: size * 0.28, left: size * 0.22, top: size * 0.22 },
          { backgroundColor: `${colors.primary}0F` },
        ]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        {ORBIT.map((item, index) => {
          const angle = (index / ORBIT.length) * 2 * Math.PI;
          return (
            <Animated.View
              key={item.icon}
              style={[
                styles.bubble,
                {
                  left: size / 2 + radius * Math.cos(angle) - BUBBLE / 2,
                  top: size / 2 + radius * Math.sin(angle) - BUBBLE / 2,
                  backgroundColor: colors.surface,
                  borderColor: `${item.tint}55`,
                  transform: [{ rotate: counterRotate }],
                },
              ]}
            >
              <FontAwesome6 name={item.icon} size={16} color={item.tint} solid />
            </Animated.View>
          );
        })}
      </Animated.View>
      <View style={styles.center} pointerEvents="none">
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
          <FontAwesome6 name={centerIcon} size={16} color="#FFFFFF" solid />
        </LinearGradient>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.text, { color: colors.textMuted }]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 1.5, borderStyle: 'dashed' },
  glow: { position: 'absolute' },
  bubble: {
    position: 'absolute',
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B2A5B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  // Kept small so the circling icons have clear room around the centre text.
  badge: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, marginTop: 6, textAlign: 'center' },
  text: { ...typography.caption, fontSize: 11, lineHeight: 15, textAlign: 'center', maxWidth: 112 },
});
