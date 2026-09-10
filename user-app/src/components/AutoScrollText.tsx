import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, TextStyle, View, ViewStyle } from 'react-native';

interface AutoScrollTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  /** Available width to display within — text wider than this scrolls; text that fits sits still. */
  containerWidth: number;
  containerStyle?: StyleProp<ViewStyle>;
}

const PAUSE_MS = 900;
const PX_PER_MS = 0.045; // ~45px/sec — slow enough to read mid-scroll, not a jarring flash.

/**
 * Single-line text that marquee-scrolls left when its natural width exceeds the space it's
 * given, so a long, truncated placeholder (e.g. `NearbySearchModal`'s search hint, once the
 * search bar shrank to share a row with the range input/unit picker) can still be read in
 * full instead of being permanently cut off. Sits still — no animation, no measuring cost
 * beyond the initial layout — when the text already fits. The trick: an unconstrained
 * `Animated.Text` (no width style) laid out inside a fixed-width `overflow: 'hidden'` View —
 * clipping a child doesn't change its own layout measurement, so `onLayout` still reports
 * the text's true natural width even though only part of it paints.
 */
export function AutoScrollText({ text, style, containerWidth, containerStyle }: AutoScrollTextProps) {
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    translateX.setValue(0);
    if (!containerWidth || !textWidth || textWidth <= containerWidth) return undefined;

    const distance = textWidth - containerWidth;
    const duration = distance / PX_PER_MS;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(PAUSE_MS),
        Animated.timing(translateX, { toValue: -distance, duration, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(PAUSE_MS),
        Animated.timing(translateX, { toValue: 0, duration, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [containerWidth, textWidth, translateX]);

  return (
    <View style={[{ width: containerWidth, overflow: 'hidden' }, containerStyle]}>
      <Animated.Text
        numberOfLines={1}
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        style={[style, { alignSelf: 'flex-start', transform: [{ translateX }] }]}
      >
        {text}
      </Animated.Text>
    </View>
  );
}
