import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleProp, TextStyle, View, ViewStyle } from 'react-native';

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
 * Four earlier attempts at this component all failed on some combination of "measures the
 * wrong width" or "only ever shows the first screenful, animation or not" — the common root
 * cause turned out to be `numberOfLines`: any `Text` with `numberOfLines` set, laid out as a
 * *normal-flow* child (even with `alignSelf: 'flex-start'`), gets measured with the nearest
 * ancestor's available width as an upper bound — RN/Yoga needs a concrete width to decide
 * *where* to truncate, so it measures "as if" constrained to that width regardless of
 * `alignSelf`, which only affects final box positioning, not the measurement pass itself.
 * That silently truncated the text's actual *content*, not just its paint, so no transform
 * could ever reveal what was cut — matching the exact reports ("still cuts off after 'or'",
 * "shop name never shows").
 *
 * The fix: don't use `numberOfLines` (or a plain `View`) for either the visible text or its
 * measurement at all. A `ScrollView`'s content is explicitly exempt from that "available
 * width" clamp — that's the entire premise of scrolling — so both problems disappear by
 * rendering the (untruncated) text as a `ScrollView`'s content: `onContentSizeChange` reports
 * its true natural width directly (no separate hidden measurer needed), the `ScrollView`'s
 * own frame (`style={{ width: containerWidth }}`) clips whatever exceeds it exactly like a
 * plain `overflow: 'hidden'` View would, and an `Animated.Text` + `translateX` inside it
 * (unchanged from every earlier attempt) slides the *fully laid-out* text left to reveal the
 * part that was clipped — since the text was never truncated at the content level this time,
 * there's actually something there for the transform to reveal.
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
    <View style={[{ width: containerWidth }, containerStyle]}>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        pointerEvents="none"
        style={{ width: containerWidth }}
        onContentSizeChange={(width) => setTextWidth(width)}
      >
        <Animated.Text style={[style, { transform: [{ translateX }] }]}>{text}</Animated.Text>
      </ScrollView>
    </View>
  );
}
