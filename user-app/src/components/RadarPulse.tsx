import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { headerGradient } from '@/theme';

interface RadarPulseProps {
  icon?: React.ComponentProps<typeof FontAwesome6>['name'];
  size?: number;
}

const RING_COUNT = 3;
const RING_DURATION_MS = 2400;

/**
 * "Searching nearby" radar — rings ripple outward from a brand-gradient centre icon,
 * staggered so one is always expanding, while the centre gently breathes. Opacity +
 * transform only, all on the native driver, so it stays smooth while the JS thread is busy
 * with the request/polling that's happening underneath.
 */
export function RadarPulse({ icon = 'tower-broadcast', size = 220 }: RadarPulseProps) {
  const rings = useRef(Array.from({ length: RING_COUNT }, () => new Animated.Value(0))).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];
    // Each ring starts its own endless loop a third of a cycle after the previous one, so
    // the stagger holds forever (a delay inside the loop would drift the rings apart).
    const timers = rings.map((ring, index) =>
      setTimeout(() => {
        const loop = Animated.loop(
          Animated.timing(ring, {
            toValue: 1,
            duration: RING_DURATION_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        );
        loops.push(loop);
        loop.start();
      }, (RING_DURATION_MS / RING_COUNT) * index),
    );

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    breatheLoop.start();

    return () => {
      timers.forEach(clearTimeout);
      loops.forEach((loop) => loop.stop());
      breatheLoop.stop();
    };
  }, [rings, breathe]);

  const coreSize = size * 0.38;
  const coreScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {rings.map((ring, index) => (
        <Animated.View
          key={index}
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: `${headerGradient[1]}80`,
              backgroundColor: `${headerGradient[1]}14`,
              opacity: ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
            },
          ]}
        />
      ))}
      {/* A soft halo so the centre glows instead of sitting flat on the background. */}
      <View
        style={[
          styles.halo,
          { width: coreSize * 1.45, height: coreSize * 1.45, borderRadius: (coreSize * 1.45) / 2, backgroundColor: `${headerGradient[1]}26` },
        ]}
      />
      <Animated.View style={{ transform: [{ scale: coreScale }] }}>
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.core, { width: coreSize, height: coreSize, borderRadius: coreSize / 2 }]}
        >
          <FontAwesome6 name={icon} size={coreSize * 0.38} color="#FFFFFF" solid />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 1.5 },
  halo: { position: 'absolute' },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0055D3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
});
