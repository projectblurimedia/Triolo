import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { FontAwesome6 } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { headerGradient, useThemeColors } from '@/theme';
import { ANDROID_REAL_BLUR, useBlurTargetStore } from '@/state/blurTargetStore';
import { useAttentionCounts } from '@/hooks/useAttentionCounts';
import { CountBadge } from './CountBadge';

// Floats on every side by the same amount — `MARGIN_H` insets the bar from the left/right
// screen edges, and `barBottom` (below) is at least `MARGIN_H` too, so the gap reads
// identical on all three sides. Several earlier passes fought this same "make the bottom
// gap match the sides" request without success because the *real* bug was elsewhere (the
// bar's wrapper wasn't bottom-aligning its content at all — see `wrapper`'s own comment) —
// once that was fixed, tuning `barBottom` finally has a real, visible effect.
const MARGIN_H = 18;
// Inner horizontal padding, so the first/last tab's content sits a small, deliberate
// distance in from the bar's own rounded edge instead of being pushed there purely by even
// flex distribution across the tab count.
const BAR_PADDING_H = 5;
// Taller than the very first version of this bar — the active-tab dot used to float above
// it; now it lives inside the bar, below the icon, so the bar needs enough height for both
// stacked vertically with breathing room on every side.
const BAR_HEIGHT = 66;
const BAR_RADIUS = BAR_HEIGHT / 2;

const DOT_SIZE = 6;
const DOT_MARGIN_TOP = -2;

// Diameter of the tinted circle behind the active tab's icon — brought back down from an
// earlier 52 now that it has to share the bar's vertical space with the dot below it rather
// than the icon alone owning the bar's full height.
const ICON_BG_SIZE = 40;

// Glassmorphism, kept deliberately simple so it reads as ONE even colour of frosted glass:
//   1. strong real blur of whatever is behind the bar — iOS natively (Apple's thin
//      material); Android 12+ via expo-blur's Dimezis method, blurring the active tab
//      screen's BlurTargetView (see state/blurTargetStore.ts). Older Android gets no blur
//      (too slow) and a near-opaque frosted fill instead.
//   2. one uniform, light translucent tint over the blur (light enough that the blurred
//      content behind actually shows — that is what makes it read as glass)
// plus a single even hairline border. No sheen/inner-shade gradients or per-side rim colours
// (they made the bar look two-toned), and no Android elevation — an elevation shadow shows
// *through* translucent glass and read as a grey box inside the bar.
const IOS_BLUR_INTENSITY = 100;
// On Android, expo-blur's `intensity` drives TWO things (see its TintStyle.kt/ExpoBlurView.kt):
// the blur radius (intensity / reductionFactor) AND the opacity of its own built-in tint
// overlay (intensity% × ~0.7–0.8 for light/dark). At intensity 100 that built-in tint alone
// was ~78% opaque white, which — stacked with our own tint — hid the blur completely and
// read as a flat background colour. So: a LOW intensity keeps the built-in tint light (~25%),
// and a reduction factor below 1 still gives a strong ~40px blur radius (32 / 0.8).
const ANDROID_BLUR_INTENSITY = 32;
const ANDROID_BLUR_REDUCTION = 0.8;
const GLASS_LIGHT = {
  iosTint: 'systemThinMaterialLight' as const,
  // 'default' = expo-blur's pure-white tint (255) at ~14% here; 'light' is a neutral grey
  // (249) at ~25%, which made the light bar look dull/sandy instead of the app's cool white.
  androidTint: 'default' as const,
  // A cool, slightly blue-leaning white (a touch cooler than the app background #F9FCFF,
  // theme/colors.ts) so the bar reads crisp and cool, never sandy, even over warm content.
  tintIos: 'rgba(236, 244, 255, 0.5)',
  tintAndroidBlur: 'rgba(236, 244, 255, 0.5)',
  // Android without blur — near-opaque so content behind doesn't read as a mess.
  solidAndroid: 'rgba(240, 247, 255, 0.95)',
  border: 'rgba(255, 255, 255, 0.55)',
  shadowOpacity: 0.08,
};
const GLASS_DARK = {
  iosTint: 'systemThinMaterialDark' as const,
  androidTint: 'dark' as const,
  tintIos: 'rgba(18, 22, 30, 0.15)',
  tintAndroidBlur: 'rgba(18, 22, 30, 0.15)',
  solidAndroid: 'rgba(22, 27, 36, 0.94)',
  border: 'rgba(255, 255, 255, 0.12)',
  shadowOpacity: 0.3,
};

const ICONS: Record<string, React.ComponentProps<typeof FontAwesome6>['name']> = {
  Home: 'house',
  Bookings: 'calendar-check',
  Grow: 'crown',
  Profile: 'user',
};

// One brand-blue gradient for every tab — this app has no per-tab colour identity.
const ACTIVE_GRADIENTS: Record<string, readonly [string, string]> = {
  Home: headerGradient,
  Bookings: headerGradient,
  Grow: headerGradient,
  Profile: headerGradient,
};

/**
 * Custom bottom tab bar: a floating rounded card where the active tab is marked by a small
 * gradient dot sitting inside the bar, just below its icon — not floating above the bar the
 * way an earlier version of this component had it. Each tab stacks a tinted-circle-backed
 * icon (crossfading muted→brand-colored) above its own dot, both driven by one
 * `Animated.Value` per tab (`progressAnims`, opacity + transform only, `useNativeDriver:
 * true` so it stays smooth on the UI thread) — no per-tab position needs to slide anymore,
 * since the dot now lives directly under the icon it belongs to rather than traveling
 * between tabs. A shared `popScale` value sprung past 1 on every tab change gives the
 * selected icon's backdrop and its dot a visible "pop" bigger than their resting size, not
 * just a linear scale-up. Icon color itself is never animated directly (a vector-icon
 * component like `FontAwesome6` isn't a plain host view, so there's no guarantee `Animated`
 * can push prop updates through it) — instead two plain-colored icons are stacked and their
 * wrapping `Animated.View`s crossfade. Positioned `position: 'absolute'` so it contributes
 * no height to the screen's flex layout and content can render/scroll behind it.
 */
export function CustomTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors, isDark } = useThemeColors();
  const progressAnims = useRef(state.routes.map((_, index) => new Animated.Value(index === state.index ? 1 : 0))).current;
  // Requests and work under way (jobs and shop orders) as a red count on the Bookings icon.
  const attention = useAttentionCounts();
  // Activity is a record, not an alert: no count on its icon (Home shows what's waiting).
  const counts: Record<string, number> = {};
  void attention;
  // A single shared bounce value for whichever tab is becoming active — reset low and
  // sprung back past 1 on every change, so the selected tab's backdrop circle and dot
  // visibly "pop" a little larger before settling, not just fade/scale linearly to their
  // resting size. Deliberately not applied to the icon glyph itself — applying it there too
  // (an earlier version did) let the icon's overshoot outgrow its own backdrop circle during
  // the spring; the icon's own scale stays modest (`iconScale`, capped at 1.08) so it stays
  // safely contained at every point in the animation, not just at rest. Applied
  // unconditionally across every tab (harmless on the others since their opacity is fading
  // toward 0 regardless).
  const popScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    popScale.setValue(0.7);
    Animated.spring(popScale, {
      toValue: 1,
      friction: 5,
      tension: 180,
      useNativeDriver: true,
    }).start();

    // Opacity + transform (scale) only — no color interpolation — so this can run fully on
    // the native (UI) thread instead of the JS thread, which is what actually makes the
    // crossfade read as smooth rather than slightly stepped/laggy.
    progressAnims.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: index === state.index ? 1 : 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index]);

  const barBottom = Math.max(insets.bottom, MARGIN_H);
  const glass = isDark ? GLASS_DARK : GLASS_LIGHT;
  const activeRouteKey = state.routes[state.index]?.key;
  const blurTarget = useBlurTargetStore((store) => (activeRouteKey ? store.targets[activeRouteKey] : undefined));
  const setActiveKey = useBlurTargetStore((store) => store.setActiveKey);
  useEffect(() => {
    setActiveKey(activeRouteKey ?? null);
  }, [activeRouteKey, setActiveKey]);
  const androidBlurring = ANDROID_REAL_BLUR && !!blurTarget;

  // Android has no elevation shadow (see the comment above GLASS_LIGHT), so the shell only
  // needs a background when it *is* the glass — older Android without blur.
  const shellBackground = Platform.OS === 'android' && !androidBlurring ? glass.solidAndroid : undefined;

  return (
    <View style={[styles.wrapper, { height: barBottom + BAR_HEIGHT }]} pointerEvents="box-none">
      {/* Shadow lives on this outer shell; the inner `glassClip` clips the glass layers to
          the pill shape (iOS can't draw a shadow on a view that also clips its children). */}
      <View
        style={[
          styles.shadowShell,
          { marginHorizontal: MARGIN_H, marginBottom: barBottom, backgroundColor: shellBackground },
          Platform.OS === 'ios' ? { shadowOpacity: glass.shadowOpacity } : null,
        ]}
      >
        <View style={[styles.glassClip, { borderColor: glass.border }]} pointerEvents="none">
          {Platform.OS === 'ios' ? (
            <>
              <BlurView intensity={IOS_BLUR_INTENSITY} tint={glass.iosTint} style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.tintIos }]} />
            </>
          ) : null}
          {androidBlurring ? (
            <>
              {/* Keyed by tab so switching tabs re-attaches the blur to the new screen. */}
              <BlurView
                key={activeRouteKey}
                blurTarget={blurTarget}
                blurMethod="dimezisBlurViewSdk31Plus"
                intensity={ANDROID_BLUR_INTENSITY}
                blurReductionFactor={ANDROID_BLUR_REDUCTION}
                tint={glass.androidTint}
                style={StyleSheet.absoluteFill}
              />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.tintAndroidBlur }]} />
            </>
          ) : null}
        </View>

        <View style={styles.bar}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const progress = progressAnims[index];
            const gradient = ACTIVE_GRADIENTS[route.name] ?? headerGradient;
            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const bgScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
            const iconScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
            const iconLift = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
            const mutedOpacity = Animated.subtract(1, progress);

            return (
              <Pressable
                key={route.key}
                style={styles.tabButton}
                onPress={onPress}
                accessibilityLabel={route.name}
                android_ripple={{ color: 'transparent' }}
              >
                <View style={styles.tabContent}>
                  {/* `iconArea`'s own layout box (its size, used to center it inside
                    `tabButton`) is untouched by `transform` — so every tab's icon sits at
                    the bar's true vertical center at rest, and only the selected tab's
                    rendered pixels shift up via `iconLift`, revealing its dot below. */}
                  <Animated.View style={[styles.iconArea, { transform: [{ translateY: iconLift }] }]}>
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.iconBg,
                        {
                          // A small brand-tinted bubble — no rim/border, per explicit feedback.
                          backgroundColor: isDark ? `${gradient[1]}3D` : `${gradient[0]}24`,
                          opacity: progress,
                          transform: [{ scale: bgScale }, { scale: popScale }],
                        },
                      ]}
                    />
                    <View style={styles.iconStack}>
                      <Animated.View style={{ opacity: mutedOpacity, transform: [{ scale: iconScale }] }}>
                        <FontAwesome6 name={ICONS[route.name]} size={20} color={colors.textMuted} solid />
                      </Animated.View>
                      <Animated.View
                        style={[
                          StyleSheet.absoluteFill,
                          styles.iconOverlayCenter,
                          { opacity: progress, transform: [{ scale: iconScale }] },
                        ]}
                      >
                        <FontAwesome6 name={ICONS[route.name]} size={20} color={gradient[0]} solid />
                      </Animated.View>
                    </View>
                    <CountBadge count={counts[route.name] ?? 0} style={styles.countBadge} />
                  </Animated.View>

                  {/* Absolutely positioned against `tabContent`'s own (untransformed)
                    box — anchored just below the icon's resting position, not its lifted
                    one, so the gap between icon and dot visibly opens up on selection. */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.dotShadowWrap,
                      Platform.OS === 'ios' ? { shadowColor: gradient[0] } : null,
                      { opacity: progress, transform: [{ scale: popScale }] },
                    ]}
                  >
                    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dot} />
                  </Animated.View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // position: 'absolute' so this contributes ~0 intrinsic height to BottomTabView's own
  // flex layout — screens render full-height with the bar floating on top, matching the
  // rest of the app's floating-overlay chrome conventions.
  // `bar` is a normal-flow child, not absolutely positioned, and this wrapper's own height
  // can exceed `bar`'s (via `barBottom`'s margin) — without `justifyContent: 'flex-end'`,
  // RN's default `flex-start` would leave `bar` sitting at the TOP of this container instead
  // of its bottom, opening a dead gap between the bar and the screen's true bottom edge.
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
  },
  // A barely-there, wide shadow on iOS only (opacity per theme, inline). No Android
  // elevation — it shows through the translucent glass as a grey box.
  shadowShell: {
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    ...Platform.select({
      ios: { shadowColor: '#0B1B3F', shadowOffset: { width: 0, height: 8 }, shadowRadius: 24 },
    }),
  },
  glassClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BAR_RADIUS,
    borderWidth: 1,
    overflow: 'hidden',
  },
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    paddingHorizontal: BAR_PADDING_H,
  },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // `dotShadowWrap` is the only other child, and it's `position: 'absolute'` — so this box's
  // own layout size is driven entirely by `iconArea` (its one normal-flow child), which is
  // what keeps every tab's icon truly centered in the bar regardless of the dot below it.
  tabContent: { alignItems: 'center', justifyContent: 'center' },
  countBadge: { position: 'absolute', top: 3, right: -3, zIndex: 2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4 },
  iconArea: { width: ICON_BG_SIZE, height: ICON_BG_SIZE, alignItems: 'center', justifyContent: 'center' },
  iconBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: ICON_BG_SIZE,
    height: ICON_BG_SIZE,
    borderRadius: ICON_BG_SIZE / 2,
  },
  iconStack: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  iconOverlayCenter: { alignItems: 'center', justifyContent: 'center' },
  // `top`, not `marginTop` — anchored against `tabContent`'s own untransformed box (i.e.
  // `iconArea`'s resting position), not a flow-affecting margin, so it never nudges
  // `iconArea` off the bar's true vertical center the way a shared, always-reserved margin
  // did in an earlier version of this layout.
  dotShadowWrap: {
    position: 'absolute',
    top: ICON_BG_SIZE + DOT_MARGIN_TOP,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.6, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  dot: { flex: 1, borderRadius: DOT_SIZE / 2 },
});
