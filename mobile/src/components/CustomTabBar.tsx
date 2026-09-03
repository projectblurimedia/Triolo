import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { headerGradient, useThemeColors } from '@/theme';
import { SHOP_GRADIENT } from './BusinessProfileModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_HEIGHT = 64;
// The bar floats above the bottom edge with margin on every side (iOS-style glass tab bar
// — Instagram/App Store), instead of spanning full-width and sitting flush with the
// bottom — a deliberate full redesign, not a tweak of the previous notch-and-bubble bar.
const BAR_MARGIN_HORIZONTAL = 16;
const BAR_MARGIN_BOTTOM = 16;
const BAR_RADIUS = BAR_HEIGHT / 2;
const BAR_WIDTH = SCREEN_WIDTH - BAR_MARGIN_HORIZONTAL * 2;

// The selected tab's capsule background, sized to sit comfortably inside the bar's own
// height with margin above/below — a rounded-rect pill (not a full circle), matching the
// App Store reference more than Instagram's plain dot indicator.
const PILL_WIDTH = 56;
const PILL_HEIGHT = 44;
const PILL_RADIUS = PILL_HEIGHT / 2;

const ICONS: Record<string, React.ComponentProps<typeof FontAwesome6>['name']> = {
  Home: 'house',
  Services: 'screwdriver-wrench',
  Bazaar: 'store',
  Profile: 'user',
};

// Bazaar's pill matches its own established orange identity (SHOP_GRADIENT — same as its
// header, icon dock, and profile card); every other tab uses the constant brand blue.
const PILL_GRADIENTS: Record<string, readonly [string, string]> = {
  Home: headerGradient,
  Services: headerGradient,
  Bazaar: SHOP_GRADIENT,
  Profile: headerGradient,
};

interface CustomTabBarProps extends BottomTabBarProps {
  /**
   * Ref to the `BlurTargetView` (in `AppNavigator`) wrapping the screen content this bar's
   * glass effect blurs — required for `BlurView`'s Android blur method to have something
   * to sample. iOS doesn't need it (it blurs whatever's directly behind natively).
   */
  blurTarget?: React.RefObject<View | null>;
}

/**
 * Custom bottom tab bar: an iOS-style floating glass pill (blurred, translucent,
 * margin on every side) instead of a full-width flat bar — modeled directly on a
 * reference (Instagram/App Store tab bars) the user shared, replacing every previous
 * design of this component (a concave notch, a raised hill, a same-color hidden circle,
 * an in-row pill) outright rather than iterating on any of them. The selected tab gets a
 * sliding colored capsule behind its icon, the same proven `translateX`-on-a-plain-
 * `Animated.Value` mechanism every earlier version of this component has used
 * successfully.
 */
export function CustomTabBar({ state, navigation, insets, blurTarget }: CustomTabBarProps) {
  const { colors, isDark } = useThemeColors();
  const tabCount = state.routes.length;
  const tabWidth = BAR_WIDTH / tabCount;
  const centers = state.routes.map((_, index) => tabWidth * index + tabWidth / 2);

  const pillX = useRef(new Animated.Value(centers[state.index])).current;

  useEffect(() => {
    Animated.timing(pillX, {
      toValue: centers[state.index],
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index]);

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + BAR_MARGIN_BOTTOM }]}>
      <View style={styles.shadowWrap}>
        <View style={styles.glassClip}>
          <BlurView
            intensity={90}
            tint={isDark ? 'dark' : 'light'}
            // 'dimezisBlurView' (not the SDK31Plus-only variant) actually blurs on every
            // Android version, not just 31+ — the SDK31Plus variant silently falls back to
            // a flat tinted view with no blur at all below that, which is why the glass
            // effect wasn't reading as real glass on older/mid-range Android devices (this
            // app's primary market). A per-frame blur cost on a bar that only re-renders on
            // tab change is cheap enough to accept the documented perf tradeoff for.
            blurMethod="dimezisBlurView"
            blurTarget={blurTarget}
            style={StyleSheet.absoluteFill}
          />
          {/* A light brand-surface tint over the raw blur — just enough to keep icon
              contrast and brand consistency predictable regardless of what's blurring
              behind it, without smothering the blur itself into a flat painted panel. */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.surface, opacity: isDark ? 0.22 : 0.3 },
            ]}
          />
          {/* The "shine": a soft white highlight catching the top of the glass, fading out
              by the vertical middle — this is what reads as a glossy, lit surface rather
              than a flat frosted panel, matching the reference's iOS glass look. */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.38)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <Animated.View
            style={[styles.pill, { transform: [{ translateX: Animated.subtract(pillX, PILL_WIDTH / 2) }] }]}
          >
            <LinearGradient
              colors={PILL_GRADIENTS[state.routes[state.index].name] ?? headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.pillFill}
            />
          </Animated.View>

          <View style={styles.row}>
            {state.routes.map((route, index) => {
              const isFocused = state.index === index;
              const onPress = () => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <Pressable
                  key={route.key}
                  style={styles.tabButton}
                  onPress={onPress}
                  accessibilityLabel={route.name}
                  android_ripple={{ color: 'transparent' }}
                >
                  <FontAwesome6
                    name={ICONS[route.name]}
                    size={20}
                    color={isFocused ? '#FFFFFF' : colors.textMuted}
                    solid
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Absolutely positioned so this component contributes ~0 intrinsic height to
  // BottomTabView's own flex column layout (an absolutely-positioned child doesn't affect
  // its parent's content size in React Native, same as CSS) — @react-navigation/bottom-tabs
  // otherwise treats a custom tabBar as a normal flex sibling next to the screens container
  // (both under a flex-column parent), shrinking the screens area to leave room for it.
  // For a floating glass bar to actually show real scrolling content behind/around it (the
  // whole point of the effect), screens need to render their full height, with this bar
  // overlaying the bottom of that full-height content instead of sitting in its own
  // reserved strip — otherwise what's "around" the pill is just the screen's own
  // background ending abruptly, not real content, which is what read as an ugly flat panel
  // instead of glass.
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shadowWrap: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    // Soft floating shadow — the bar reads as elevated above the screen content, not
    // flush against it, matching the reference's floating pill.
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16 },
      android: { elevation: 12 },
    }),
  },
  glassClip: {
    flex: 1,
    borderRadius: BAR_RADIUS,
    // BlurView's own borderRadius isn't reliably applied on Android — clipping via a
    // wrapping View's overflow:hidden is the documented workaround.
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  row: { flexDirection: 'row', height: BAR_HEIGHT },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: {
    position: 'absolute',
    top: (BAR_HEIGHT - PILL_HEIGHT) / 2,
    left: 0,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
  },
  pillFill: {
    flex: 1,
    borderRadius: PILL_RADIUS,
  },
});
