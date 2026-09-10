import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

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
 * Two earlier versions of this component tried to measure the text's true natural width by
 * laying an (invisible, then invisible-and-absolutely-positioned) plain `Text` node next to
 * the visible one and reading its `onLayout` — neither reliably reported a width wider than
 * the container in practice. This version measures a fundamentally different way: a hidden
 * (`height: 0`, `opacity: 0`) horizontal `ScrollView` whose `onContentSizeChange` reports its
 * content's true size. A `ScrollView`'s content is explicitly allowed to exceed its own
 * viewport — that's its entire purpose — so this measurement isn't subject to the same
 * parent-width-clamping ambiguity a plain (even absolutely positioned) `Text` node has.
 * `scrollEnabled={false}`/`pointerEvents="none"` keep it purely a measuring instrument, never
 * interactive. The *visible* copy animates via a plain `Animated.Text` + `translateX` —
 * which needed its own fix too, once the measurement itself started working: without
 * `alignSelf: 'flex-start'`, the parent's default `alignItems: 'stretch'` was shrinking the
 * visible `Text`'s own layout box down to the container's width, so `numberOfLines`/
 * `ellipsizeMode="clip"` truncated its actual *content* at that width before `translateX`
 * ever ran — the overflowing tail was never laid out at all, so no amount of scrolling could
 * reveal it. See the inline comment below for the fuller explanation.
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
        {/* `alignSelf: 'flex-start'` is load-bearing, not decoration: without it, the
            parent's default `alignItems: 'stretch'` shrinks this Text's own layout box down
            to `containerWidth` — which makes `numberOfLines`/`ellipsizeMode="clip"` truncate
            the text's actual *content* at that width, before `translateX` ever runs. The
            overflowing tail then simply never gets laid out at all, no matter how far the
            transform slides it — reported as "shows the start of the placeholder, never the
            rest, even though it's supposedly scrolling." `alignSelf: 'flex-start'` lets this
            Text lay out at its own full natural width (extending past the parent's bound),
            so the parent's `overflow: 'hidden'` is a pure paint-time clip and the transform
            actually reveals real content that was already there. */}
        <Animated.Text
          numberOfLines={1}
          ellipsizeMode="clip"
          style={[style, { alignSelf: 'flex-start', transform: [{ translateX }] }]}
        >
          {text}
        </Animated.Text>
      </View>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        pointerEvents="none"
        style={styles.measurerScroll}
        onContentSizeChange={(width) => setTextWidth(width)}
      >
        <Text numberOfLines={1} style={style}>
          {text}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  measurerScroll: { height: 0, opacity: 0 },
});
