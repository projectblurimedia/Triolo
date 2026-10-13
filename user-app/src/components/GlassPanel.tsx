import React, { PropsWithChildren, RefObject, useEffect, useState } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useThemeColors } from '@/theme';
import { ANDROID_REAL_BLUR } from '@/state/blurTargetStore';

/**
 * The bottom tab bar's frosted glass (see CustomTabBar's notes on the tuning) as a reusable
 * panel: real blur of whatever scrolls behind it plus one even, cool-white (or dark) tint.
 *
 * On Android 12+, real blur needs the content behind to live in a `BlurTargetView` whose ref
 * is passed as `blurTarget` — without one (or on older Android) the panel falls back to a
 * near-opaque frosted fill. iOS always blurs natively.
 */

// Same values as CustomTabBar: low Android intensity keeps expo-blur's own built-in tint light.
const IOS_BLUR_INTENSITY = 100;
const ANDROID_BLUR_INTENSITY = 32;
const ANDROID_BLUR_REDUCTION = 0.8;

const LIGHT = {
  iosTint: 'systemThinMaterialLight' as const,
  androidTint: 'default' as const,
  tint: 'rgba(236, 244, 255, 0.55)',
  solid: 'rgba(240, 247, 255, 0.96)',
  border: 'rgba(255, 255, 255, 0.6)',
};
const DARK = {
  iosTint: 'systemThinMaterialDark' as const,
  androidTint: 'dark' as const,
  tint: 'rgba(18, 22, 30, 0.25)',
  solid: 'rgba(22, 27, 36, 0.95)',
  border: 'rgba(255, 255, 255, 0.12)',
};

interface GlassPanelProps {
  blurTarget?: RefObject<View | null>;
  style?: StyleProp<ViewStyle>;
  /** Draw the hairline border (off for full-width bars that only want a bottom edge). */
  bordered?: boolean;
}

export function GlassPanel({ blurTarget, style, bordered = true, children }: PropsWithChildren<GlassPanelProps>) {
  const { isDark } = useThemeColors();
  const glass = isDark ? DARK : LIGHT;
  // The BlurView needs the target already mounted, so it only switches on after the first
  // commit (the same timing the tab bar relies on); until then the frosted fill shows.
  const [targetReady, setTargetReady] = useState(false);
  useEffect(() => {
    if (blurTarget?.current && !targetReady) setTargetReady(true);
  });
  const androidBlur = Platform.OS === 'android' && ANDROID_REAL_BLUR && !!blurTarget && targetReady;

  return (
    <View style={[styles.panel, bordered ? { borderWidth: 1, borderColor: glass.border } : null, style]}>
      {Platform.OS === 'ios' ? (
        <>
          <BlurView intensity={IOS_BLUR_INTENSITY} tint={glass.iosTint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.tint }]} />
        </>
      ) : androidBlur ? (
        <>
          <BlurView
            blurTarget={blurTarget}
            blurMethod="dimezisBlurViewSdk31Plus"
            intensity={ANDROID_BLUR_INTENSITY}
            blurReductionFactor={ANDROID_BLUR_REDUCTION}
            tint={glass.androidTint}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.tint }]} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.solid }]} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { overflow: 'hidden' },
});
