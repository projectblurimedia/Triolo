import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

const DOT_COUNT = 3;

interface LoadingIndicatorProps {
  size?: number;
  color?: string;
  dotSize?: number;
  /** Full rotation duration in ms — larger instances read better slower (e.g. LogoutOverlay uses 1800). */
  duration?: number;
}

/**
 * The app's signature loading motif — dots orbiting a center point — used everywhere a
 * loading state needs an affordance, instead of the platform's generic ActivityIndicator.
 * Extracted from LogoutOverlay's full-screen version (which additionally has a pulsing
 * center mark, appropriate at that larger scale but not needed for an inline spinner).
 */
export function LoadingIndicator({ size = 22, color = '#FFFFFF', dotSize = 4, duration = 900 }: LoadingIndicatorProps) {
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
