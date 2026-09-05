import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { headerGradient, useThemeColors } from '@/theme';

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

const ICONS: Record<string, React.ComponentProps<typeof FontAwesome6>['name']> = {
  Home: 'house',
  Services: 'screwdriver-wrench',
  PrepareList: 'list-check',
  Bazaar: 'store',
  Profile: 'user',
};

// Every tab uses the same constant brand blue in the tab bar itself. Bazaar's header and
// BazaarMenuDrawer also use this blue (per follow-up feedback) — only BusinessProfileCard
// and BusinessProfileModal still carry the orange "Business capability" identity, which is
// a separate concept from "the Bazaar tab's own chrome."
const ACTIVE_GRADIENTS: Record<string, readonly [string, string]> = {
  Home: headerGradient,
  Services: headerGradient,
  PrepareList: headerGradient,
  Bazaar: headerGradient,
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
  const { colors } = useThemeColors();
  const progressAnims = useRef(
    state.routes.map((_, index) => new Animated.Value(index === state.index ? 1 : 0)),
  ).current;
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

  return (
    <View style={[styles.wrapper, { height: barBottom + BAR_HEIGHT }]} pointerEvents="box-none">
      <View
        style={[
          styles.bar,
          {
            marginHorizontal: MARGIN_H,
            marginBottom: barBottom,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
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
                        backgroundColor: `${gradient[0]}1A`,
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
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    borderWidth: 1,
    paddingHorizontal: BAR_PADDING_H,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16 },
      android: { elevation: 14 },
    }),
  },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // `dotShadowWrap` is the only other child, and it's `position: 'absolute'` — so this box's
  // own layout size is driven entirely by `iconArea` (its one normal-flow child), which is
  // what keeps every tab's icon truly centered in the bar regardless of the dot below it.
  tabContent: { alignItems: 'center', justifyContent: 'center' },
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
