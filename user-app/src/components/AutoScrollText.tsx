import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

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
 * full instead of being permanently cut off. Sits still — no animation — when the text
 * already fits.
 *
 * Measuring the "true" width needs a second, invisible copy of the text — the first version
 * measured the *visible* copy directly and consistently got back a width clamped to
 * `containerWidth`, since RN/Yoga passes a normal-flow text node's parent width down as an
 * upper bound during its own measurement, regardless of `alignSelf`. A second attempt nested
 * an absolutely positioned measurer *inside* the same width-constrained, `overflow: hidden`
 * clipping View — still unreliable in practice. This version renders the invisible measurer
 * as a sibling **outside** that clipping View entirely (both under one plain, unconstrained
 * wrapper), removing any ambiguity about whether being a descendant of a width-bound node
 * affects how Yoga measures an absolutely positioned child. The visible copy also always
 * uses `ellipsizeMode="clip"` (never the default `"tail"`) regardless of whether overflow
 * has been confirmed yet — a stray "…" can then never appear even for the one frame before
 * the measurer's first `onLayout` fires, since `"clip"` and `"tail"` look identical when the
 * text isn't actually being cut.
 */
export function AutoScrollText({ text, style, containerWidth, containerStyle }: AutoScrollTextProps) {
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const overflowing = containerWidth > 0 && textWidth > containerWidth;

  useEffect(() => {
    translateX.setValue(0);
    if (!overflowing) return undefined;

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
  }, [overflowing, textWidth, containerWidth, translateX]);

  return (
    <View style={containerStyle}>
      <View style={{ width: containerWidth, overflow: 'hidden' }}>
        <Animated.Text numberOfLines={1} ellipsizeMode="clip" style={[style, { transform: [{ translateX }] }]}>
          {text}
        </Animated.Text>
      </View>
      <Text style={[style, styles.measurer]} onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  measurer: { position: 'absolute', top: 0, left: 0, opacity: 0 },
});
