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
 * Measuring the "true" width needed a second, invisible copy of the text — the first
 * version measured the *visible* copy directly and consistently got back a width clamped to
 * `containerWidth` (never larger), so `textWidth <= containerWidth` was always true and
 * nothing ever animated; RN/Yoga passes the parent's available width down as an upper bound
 * to a normal-flow text node's own measurement, `alignSelf: 'flex-start'` included, so that
 * copy can never self-report as wider than its container. An **absolutely positioned**
 * sibling text node, on the other hand, is measured independently of the parent's available
 * width (no `left`/`right` given, so Yoga doesn't clamp it) — `measurer` below exists only
 * to read its real `onLayout` width via that mechanism, rendered invisibly (`opacity: 0`)
 * behind the visible copy. The visible copy also switched from the default `ellipsizeMode`
 * ("tail", which silently drew a trailing "…" instead of scrolling) to `"clip"` once it's
 * known to overflow, so the hidden tail becomes readable by scrolling into view rather than
 * being replaced by an ellipsis.
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
    <View style={[{ width: containerWidth, overflow: 'hidden' }, containerStyle]}>
      <Text
        style={[style, styles.measurer]}
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        numberOfLines={1}
      >
        {text}
      </Text>
      <Animated.Text
        numberOfLines={1}
        ellipsizeMode={overflowing ? 'clip' : 'tail'}
        style={[style, { transform: [{ translateX }] }]}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  measurer: { position: 'absolute', opacity: 0 },
});
