import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { BrandMotion } from './brand/BrandMotion';

const DOT_COUNT = 3;

interface LoadingIndicatorProps {
  size?: number;
  color?: string;
  dotSize?: number;
  /** Full rotation duration in ms — larger instances read better slower (e.g. LogoutOverlay uses 1800). */
  duration?: number;
}

// Below this the NearbyU mark is too small to read, so the old orbiting dots stay.
const MARK_MIN = 20;
// From this size up the loader also draws the rings and the three helpers.
const RINGS_MIN = 56;

/**
 * The app's loader, used everywhere a loading state needs an affordance: the NearbyU motion on
 * a loop (BrandMotion, docs/brand-nearbyu) — the pin drops, the road draws to the home, the home
 * pops up; with rings and helpers at larger sizes. Tiny sizes keep the orbiting dots.
 */
export function LoadingIndicator(props: LoadingIndicatorProps) {
  const { size = 22, color = '#FFFFFF' } = props;
  if (size < MARK_MIN) return <OrbitDots {...props} />;
  return <BrandMotion size={size} color={color} rings={size >= RINGS_MIN} mode="loop" />;
}

/** The earlier loader: dots orbiting a centre point (kept for the tiniest sizes). */
function OrbitDots({ size = 22, color = '#FFFFFF', dotSize = 4, duration = 900 }: LoadingIndicatorProps) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [rotation, duration]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const radius = size / 2 - dotSize / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: spin }] }}
      >
        {Array.from({ length: DOT_COUNT }).map((_, index) => {
          const angle = (360 / DOT_COUNT) * index;
          return (
            <View
              key={index}
              style={{
                position: 'absolute',
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: color,
                transform: [{ rotate: `${angle}deg` }, { translateY: -radius }],
              }}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}
