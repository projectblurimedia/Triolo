import React, { PropsWithChildren, RefObject } from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { ANDROID_REAL_BLUR, useBlurTargetStore } from '@/state/blurTargetStore';
import { useThemeColors } from '@/theme';

/**
 * The tab bar's frosted glass for the menus: the profile/settings menu sheets and the side
 * drawers. (By the user's choice, glass is kept to the tab bar, the worker profile's sticky
 * header and these menus; popups, pickers and toasts are solid cards.) The screen around a
 * menu is only dimmed; the sheet or panel itself is the glass: the screen behind shows
 * through, blurred and softly tinted, with a hairline rim.
 *
 * Android 12+ can only blur content inside a `BlurTargetView`, so menus blur the tab screen
 * on show (`blurTargetStore.activeKey`). Older Android gets a near-solid frosted fill; iOS
 * blurs natively.
 */

// Heavier than the tab bar (whose tuning is separate), so text on a card stays easy to read
// over a busy screen. On Android the radius is intensity / reduction (80px here) while
// expo-blur's own built-in tint follows intensity alone, so intensity stays low (see
// CustomTabBar) and the stronger blur comes from the reduction factor.
const IOS_BLUR_INTENSITY = 100;
const ANDROID_BLUR_INTENSITY = 32;
const ANDROID_BLUR_REDUCTION = 0.4;

function useOverlayBlurTarget(): RefObject<View | null> | undefined {
  return useBlurTargetStore((store) => (store.activeKey ? store.targets[store.activeKey] : undefined));
}

/** Glass colours for the current theme, and whether real blur sits behind them. */
export function useGlass() {
  const { isDark } = useThemeColors();
  const target = useOverlayBlurTarget();
  const blurred = Platform.OS === 'ios' || (ANDROID_REAL_BLUR && !!target?.current);
  return {
    target,
    blurred,
    isDark,
    /** The glass tint over the blur (or a near-solid frosted fill where there's no blur). */
    tint: blurred
      ? isDark
        ? 'rgba(22, 27, 37, 0.66)'
        : 'rgba(240, 246, 255, 0.72)'
      : isDark
        ? 'rgba(24, 29, 38, 0.97)'
        : 'rgba(246, 250, 255, 0.98)',
    border: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.8)',
    /** The plain dim around an overlay — no blur. */
    dim: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(10, 22, 44, 0.35)',
    /** A subtle fill for controls sitting on glass (secondary buttons, rows). */
    control: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.55)',
  };
}

/**
 * The glass itself: real blur of the screen behind plus the tint. Put it as the first child of
 * any container with `overflow: 'hidden'` (cards, sheets, drawer panels).
 */
export function GlassFill() {
  const glass = useGlass();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={IOS_BLUR_INTENSITY}
          tint={glass.isDark ? 'systemMaterialDark' : 'systemMaterialLight'}
          style={StyleSheet.absoluteFill}
        />
      ) : glass.blurred ? (
        <BlurView
          blurTarget={glass.target}
          blurMethod="dimezisBlurViewSdk31Plus"
          intensity={ANDROID_BLUR_INTENSITY}
          blurReductionFactor={ANDROID_BLUR_REDUCTION}
          tint={glass.isDark ? 'dark' : 'default'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.tint }]} />
    </View>
  );
}

interface GlassBackdropProps {
  /** Tapping the backdrop (outside the card). */
  onPress?: () => void;
  /** Lays out the children, e.g. centred card or bottom sheet. */
  style?: StyleProp<ViewStyle>;
}

/** Just the dim layer (fills its parent, ignores touches) — for overlays that animate their own backdrop. */
export function GlassBackdropLayer() {
  const glass = useGlass();
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.dim }]} pointerEvents="none" />;
}

/** Full-screen dimmed backdrop for an overlay; its children (the glass card) float on top. */
export function GlassBackdrop({ onPress, style, children }: PropsWithChildren<GlassBackdropProps>) {
  return (
    <View style={styles.fill}>
      <GlassBackdropLayer />
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress} accessible={false} />
      <View style={[styles.fill, style]} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

/** A glass card/sheet: the blurred screen shows through it, tinted, with a hairline rim. */
export function GlassCard({ style, children }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const glass = useGlass();
  return (
    <View style={[styles.card, { borderColor: glass.border }, style]}>
      <GlassFill />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // No Android elevation: it shows through translucent glass as a grey box (see CustomTabBar).
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0B2A5B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
});
