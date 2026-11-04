import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, useWindowDimensions, Vibration, View } from 'react-native';
import { hideFullText, useFullTextStore } from '@/state/fullTextStore';
import { fonts, typography, useThemeColors } from '@/theme';

const BUBBLE_MAX = 300;
const GAP = 14;

/**
 * The bubble that shows a cut-off text in full after a long-press (FullText), above the
 * finger, over everything (its own window). Tap anywhere to close. Mounted once at the root.
 * (Copied between user-app and partner-app — keep in sync.)
 */
export function FullTextHost() {
  const { text, x, y } = useFullTextStore();
  const { colors, isDark } = useThemeColors();
  const { width, height } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;
  // The bubble's own size once laid out (it is only as wide as its text).
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setSize(null);
    if (!text) return;
    Vibration.vibrate(12);
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 140, useNativeDriver: true }).start();
  }, [text, fade]);

  if (!text) return null;
  const bubbleWidth = size?.width ?? 0;
  // Measured first at the left edge (the full width free), then centred on the finger.
  const left = size ? Math.max(16, Math.min(x - bubbleWidth / 2, width - bubbleWidth - 16)) : 16;
  // Above the finger; below it when the finger is near the top of the screen.
  const above = y > 160;
  const position = above ? { bottom: height - y + GAP } : { top: y + GAP };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={hideFullText}>
      <Pressable style={StyleSheet.absoluteFill} onPress={hideFullText} accessibilityLabel={text}>
        <Animated.View
          style={[
            styles.bubble,
            position,
            {
              left,
              maxWidth: Math.min(BUBBLE_MAX, width - 32),
              backgroundColor: isDark ? '#F2F6FC' : '#111827',
              // Hidden until measured, then placed centred on the finger.
              opacity: size ? fade : 0,
              transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [above ? 6 : -6, 0] }) }],
            },
          ]}
          onLayout={(event) => {
            const { width: w, height: hh } = event.nativeEvent.layout;
            if (!size || size.width !== w) setSize({ width: w, height: hh });
          }}
        >
          <Text selectable style={[styles.text, { color: isDark ? colors.background : '#FFFFFF' }]}>
            {text}
          </Text>
        </Animated.View>
        <View pointerEvents="none" />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  text: { ...typography.body, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
});
