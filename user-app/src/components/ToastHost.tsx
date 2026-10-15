import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/state/toastStore';
import { ANDROID_REAL_BLUR, useBlurTargetStore } from '@/state/blurTargetStore';
import { colors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

const DISPLAY_DURATION = 3600;
const ENTER_DURATION = 200;
const EXIT_DURATION = 150;
const HIDDEN_Y = -160;
// How far / how fast a drag has to go before it throws the toast away instead of snapping back.
const SWIPE_DISTANCE_X = 48;
const SWIPE_DISTANCE_UP = 36;
const SWIPE_VELOCITY = 0.3;

// The tab bar's glass, blurred harder so the message reads clearly over any screen (radius is
// intensity / reduction on Android; intensity stays low for the reason in CustomTabBar).
const IOS_BLUR_INTENSITY = 100;
const ANDROID_BLUR_INTENSITY = 32;
const ANDROID_BLUR_REDUCTION = 0.4;
const GLASS_LIGHT = {
  iosTint: 'systemMaterialLight' as const,
  androidTint: 'default' as const,
  tint: 'rgba(236, 244, 255, 0.7)',
  solid: 'rgba(244, 249, 255, 0.97)',
  border: 'rgba(255, 255, 255, 0.75)',
};
const GLASS_DARK = {
  iosTint: 'systemMaterialDark' as const,
  androidTint: 'dark' as const,
  tint: 'rgba(18, 22, 30, 0.55)',
  solid: 'rgba(24, 29, 38, 0.96)',
  border: 'rgba(255, 255, 255, 0.14)',
};

const VARIANT_CONFIG = {
  success: { gradient: [colors.success, '#0F7A37'] as const, icon: 'circle-check' as const },
  error: { gradient: ['#ef4444', '#dc2626'] as const, icon: 'circle-exclamation' as const },
  info: { gradient: headerGradient, icon: 'circle-info' as const },
};

type ExitDirection = 'up' | 'left' | 'right';

/**
 * App-wide replacement for Alert.alert, driven by toastStore so any screen or mutation can
 * call showToast(). One toast at a time (a new one replaces the current one).
 *
 * A frosted-glass card like the bottom tab bar, with a bar along the bottom counting down
 * the time left. Swipe it up, left or right to throw it away (a short drag snaps back and
 * the countdown carries on); a tap closes it too.
 *
 * The root instance (App.tsx) passes `screenBlur` so on Android 12+ it really blurs the tab
 * screen behind it. Copies inside full-screen modals (the root one draws under native
 * Modals) use the frosted fill instead; iOS always blurs.
 */
export function ToastHost({ screenBlur = false }: { screenBlur?: boolean }) {
  const toast = useToastStore((state) => state.toast);
  const hideToast = useToastStore((state) => state.hideToast);
  const { colors: themeColors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const glass = isDark ? GLASS_DARK : GLASS_LIGHT;
  const blurTarget = useBlurTargetStore((store) => (screenBlur && store.activeKey ? store.targets[store.activeKey] : undefined));
  const androidBlur = Platform.OS === 'android' && ANDROID_REAL_BLUR && !!blurTarget;

  const enterY = useRef(new Animated.Value(HIDDEN_Y)).current;
  const enterOpacity = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const remaining = useRef(new Animated.Value(1)).current;
  const leaving = useRef(false);
  // Each drag is locked to one direction (sideways or up) from its first movement, and measured
  // from where it was claimed — so a slow drag never flips axis or jumps mid-way.
  const axis = useRef<'x' | 'y' | null>(null);
  const origin = useRef({ dx: 0, dy: 0 });
  const [cardWidth, setCardWidth] = useState(Dimensions.get('window').width - 32);

  const exit = (direction: ExitDirection, velocity = 0) => {
    if (leaving.current) return;
    leaving.current = true;
    remaining.stopAnimation();
    const width = Dimensions.get('window').width;
    // A fast throw finishes sooner; a slow one still glides out instead of snapping away.
    const duration = Math.round(Math.min(230, Math.max(120, EXIT_DURATION + 60 - Math.abs(velocity) * 60)));
    const move =
      direction === 'up'
        ? Animated.timing(dragY, { toValue: HIDDEN_Y, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true })
        : Animated.timing(dragX, {
            toValue: direction === 'left' ? -width * 1.1 : width * 1.1,
            duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          });
    Animated.parallel([move, Animated.timing(enterOpacity, { toValue: 0, duration, useNativeDriver: true })]).start(() =>
      hideToast(),
    );
  };

  const snapBack = () => {
    Animated.parallel([
      Animated.spring(dragX, { toValue: 0, friction: 9, tension: 160, useNativeDriver: true }),
      Animated.spring(dragY, { toValue: 0, friction: 9, tension: 160, useNativeDriver: true }),
    ]).start();
    remaining.stopAnimation((value) => runCountdown(Math.max(value, 0.15)));
  };

  const runCountdown = (fraction: number) => {
    Animated.timing(remaining, {
      toValue: 0,
      duration: DISPLAY_DURATION * fraction,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) exit('up');
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          remaining.stopAnimation();
          dragX.stopAnimation();
          dragY.stopAnimation();
          axis.current = null;
          origin.current = { dx: 0, dy: 0 };
        },
        onPanResponderMove: (_, g) => {
          // The direction is decided by the first clear movement, then locked.
          if (axis.current === null) {
            if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) return;
            axis.current = Math.abs(g.dx) >= Math.abs(g.dy) ? 'x' : 'y';
            origin.current = { dx: g.dx, dy: g.dy };
          }
          if (axis.current === 'x') {
            const dx = g.dx - origin.current.dx;
            dragX.setValue(Math.abs(dx) < 12 ? dx * 0.6 : dx - Math.sign(dx) * 4.8);
          } else {
            const dy = g.dy - origin.current.dy;
            // Up follows the finger; down only gives a little.
            dragY.setValue(dy < 0 ? dy : dy * 0.25);
          }
        },
        onPanResponderRelease: (_, g) => {
          // Barely moved: a tap.
          if (axis.current === null) {
            exit('up');
            return;
          }
          const dx = g.dx - origin.current.dx;
          const dy = g.dy - origin.current.dy;
          if (axis.current === 'x' && (Math.abs(dx) > SWIPE_DISTANCE_X || Math.abs(g.vx) > SWIPE_VELOCITY)) {
            // Thrown against its drag direction counts as the throw's direction.
            const direction = Math.abs(g.vx) > SWIPE_VELOCITY ? (g.vx < 0 ? 'left' : 'right') : dx < 0 ? 'left' : 'right';
            exit(direction, g.vx);
          } else if (axis.current === 'y' && (dy < -SWIPE_DISTANCE_UP || g.vy < -SWIPE_VELOCITY)) {
            exit('up', g.vy);
          } else {
            snapBack();
          }
        },
        onPanResponderTerminate: () => snapBack(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!toast) return;
    leaving.current = false;
    enterY.setValue(HIDDEN_Y);
    enterOpacity.setValue(0);
    dragX.setValue(0);
    dragY.setValue(0);
    remaining.setValue(1);
    Animated.parallel([
      Animated.timing(enterY, { toValue: 0, duration: ENTER_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(enterOpacity, { toValue: 1, duration: ENTER_DURATION, useNativeDriver: true }),
    ]).start();
    runCountdown(1);
    return () => remaining.stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  if (!toast) return null;

  const config = VARIANT_CONFIG[toast.variant];
  // Fades as it's dragged sideways, so a throw reads as "gone".
  const dragFade = dragX.interpolate({ inputRange: [-260, 0, 260], outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
  const dragTilt = dragX.interpolate({
    inputRange: [-300, 0, 300],
    outputRange: ['-6deg', '0deg', '6deg'],
    extrapolate: 'clamp',
  });
  const dragScale = dragX.interpolate({ inputRange: [-300, 0, 300], outputRange: [0.94, 1, 0.94], extrapolate: 'clamp' });
  const progressX = remaining.interpolate({ inputRange: [0, 1], outputRange: [-cardWidth, 0] });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          top: insets.top + 10,
          opacity: Animated.multiply(enterOpacity, dragFade),
          transform: [
            { translateY: Animated.add(enterY, dragY) },
            { translateX: dragX },
            { rotate: dragTilt },
            { scale: dragScale },
          ],
        },
      ]}
    >
      <View style={[styles.shadow, isDark ? styles.shadowDark : null]} {...panResponder.panHandlers}>
        <View
          onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}
          style={[styles.card, { borderColor: glass.border }]}
          accessibilityRole="alert"
        >
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

          {/* A soft wash of the variant's colour behind the icon. */}
          <LinearGradient
            colors={[`${config.gradient[0]}2E`, `${config.gradient[0]}00`]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 0.6, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={styles.row}>
            <View style={[styles.iconHalo, { backgroundColor: `${config.gradient[0]}26` }]}>
              <LinearGradient colors={config.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconCircle}>
                <FontAwesome6 name={config.icon} size={16} color="#FFFFFF" solid />
              </LinearGradient>
            </View>
            <View style={styles.textGroup}>
              <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
                {toast.title}
              </Text>
              {toast.message ? (
                <Text style={[styles.message, { color: themeColors.textMuted }]} numberOfLines={2}>
                  {toast.message}
                </Text>
              ) : null}
            </View>
            <View style={[styles.closeButton, { borderColor: glass.border, backgroundColor: `${themeColors.text}0D` }]}>
              <FontAwesome6 name="xmark" size={11} color={themeColors.textMuted} solid />
            </View>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: `${config.gradient[0]}1F` }]}>
            <Animated.View
              style={[styles.progressFill, { backgroundColor: config.gradient[0], transform: [{ translateX: progressX }] }]}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 16, right: 16, zIndex: 999 },
  // iOS-only soft shadow: Android elevation shows through translucent glass as a grey box
  // (the same reason the tab bar has none).
  shadow: {
    borderRadius: 22,
    shadowColor: '#0B2A5B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
  },
  shadowDark: { shadowColor: '#000', shadowOpacity: 0.4 },
  card: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingLeft: 12, paddingRight: 12 },
  iconHalo: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  textGroup: { flex: 1 },
  title: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15 },
  message: { ...typography.caption, fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  closeButton: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 3, overflow: 'hidden' },
  progressFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
});
