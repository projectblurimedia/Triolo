import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { headerGradient, useThemeColors } from '@/theme';
import { SHOP_GRADIENT } from './BusinessProfileModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_HEIGHT = 64;
// Matches the rounded top corners the tab bar had before this custom SVG shape replaced
// the default @react-navigation rendering — dropping this was an oversight, not a
// deliberate redesign.
const BAR_RADIUS = 16;
const BUBBLE_SIZE = 54;
const BUBBLE_RADIUS = BUBBLE_SIZE / 2;
// A raised "hill" bump (the bar's top edge rising up, not a dip cutting into it) with the
// active bubble nested at its peak, merged rather than floating with a gap — modeled on a
// reference design the user shared. Built as a wide cubic-bezier bump (each side leaving
// the flat bar horizontally and arriving at the peak horizontally) rather than a true
// circular arc: a true semicircular bump narrows to a single point exactly at its peak, and
// since the bubble sits right at that peak, the mismatch between the bubble's constant
// curvature and the hill's rapidly-narrowing one created a visible "ear"-shaped notch where
// they met (confirmed by rendering both to a PNG and comparing). A bezier bump stays
// meaningfully wide near its own peak, avoiding that mismatch.
const HILL_HALF_WIDTH = 46;
const HILL_PEAK = 36;
const HILL_CURVE_REACH = 18;
// react-native-svg clips drawing to its own width/height — since the hill's peak needs to
// render *above* the bar's own top edge (y=0), the <Svg> itself is made taller by this
// amount and shifted up to compensate, rather than relying on CSS overflow (unreliable
// across platforms for this library). All path y-coordinates are offset by this same
// amount so nothing in the path is ever negative.
const SVG_TOP_OVERFLOW = HILL_PEAK;
// The minimum distance the hill's (and bubble's) center can sit from either screen edge
// before the hill would run past the bar's own rounded corner. This engages on the edge
// tabs (Home/Profile) at narrow widths — clampCenter is applied to BOTH the hill and the
// bubble's translateX identically, so they never visually separate even when clamped.
const MIN_HILL_MARGIN = BAR_RADIUS + HILL_HALF_WIDTH + 2;
// How far above the bar's flat top edge (y=0) the bubble's own *center* sits — chosen so a
// good portion of the bubble overlaps down into the hill (merged, no visible gap) while
// enough of it still pokes up above the peak to read clearly as its own circle.
const BUBBLE_CENTER_OFFSET = 20;
const BUBBLE_TOP = -BUBBLE_CENTER_OFFSET - BUBBLE_RADIUS;

/**
 * Keeps the hill center (and, identically, the bubble's) from ever running past the bar's
 * rounded corner, regardless of screen width.
 */
function clampBumpCenter(cx: number, width: number): number {
  return Math.min(Math.max(cx, MIN_HILL_MARGIN), width - MIN_HILL_MARGIN);
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

const ICONS: Record<string, React.ComponentProps<typeof FontAwesome6>['name']> = {
  Home: 'house',
  Services: 'screwdriver-wrench',
  Bazaar: 'store',
  Profile: 'user',
};

// Bazaar's bubble matches its own established orange identity (SHOP_GRADIENT — same as
// its header, icon dock, and profile card); every other tab uses the constant brand blue.
const BUBBLE_GRADIENTS: Record<string, readonly [string, string]> = {
  Home: headerGradient,
  Services: headerGradient,
  Bazaar: SHOP_GRADIENT,
  Profile: headerGradient,
};

/**
 * A bar shape with rounded top corners and a raised bezier "hill" centered at the
 * already-clamped `cx`, rising *above* the flat top edge instead of cutting into it. All
 * y-coordinates are offset by `SVG_TOP_OVERFLOW` since the containing `<Svg>` is taller
 * than the visual bar and shifted up by that same amount — see its declaration above.
 */
function buildHillPath(width: number, totalHeight: number, cx: number): string {
  const flatY = SVG_TOP_OVERFLOW;
  const peakY = 0;
  const bottomY = totalHeight + SVG_TOP_OVERFLOW;
  const leftX = cx - HILL_HALF_WIDTH;
  const rightX = cx + HILL_HALF_WIDTH;
  const a = HILL_CURVE_REACH;
  return [
    `M0,${flatY + BAR_RADIUS}`,
    `A${BAR_RADIUS},${BAR_RADIUS} 0 0,1 ${BAR_RADIUS},${flatY}`,
    `L${leftX},${flatY}`,
    `C${leftX + a},${flatY} ${cx - a},${peakY} ${cx},${peakY}`,
    `C${cx + a},${peakY} ${rightX - a},${flatY} ${rightX},${flatY}`,
    `L${width - BAR_RADIUS},${flatY}`,
    `A${BAR_RADIUS},${BAR_RADIUS} 0 0,1 ${width},${flatY + BAR_RADIUS}`,
    `L${width},${bottomY}`,
    `L0,${bottomY}`,
    `Z`,
  ].join(' ');
}

/**
 * Custom bottom tab bar: a circular "bubble" holding the active tab's icon sits nested at
 * the peak of a raised hill bump that slides to whichever tab is selected — merged into the
 * bar, not floating above it with a gap. React Native's Animated can't smoothly interpolate
 * between two arbitrary SVG path strings, so each tab's hill path is precomputed once
 * (there are only 4, fixed by tab count) and cross-faded via opacity; the bubble's own
 * `translateX` is a plain numeric Animated.Value, which *can* animate continuously.
 */
export function CustomTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors } = useThemeColors();
  const tabCount = state.routes.length;
  const tabWidth = SCREEN_WIDTH / tabCount;
  // Clamped up front so the hill and the bubble (which shares this same array for its
  // translateX target) are always visually locked together — see clampBumpCenter's doc.
  const centers = state.routes.map((_, index) =>
    clampBumpCenter(tabWidth * index + tabWidth / 2, SCREEN_WIDTH),
  );
  const totalHeight = BAR_HEIGHT + insets.bottom;

  const bubbleX = useRef(new Animated.Value(centers[state.index])).current;
  const hillOpacities = useRef(
    state.routes.map((_, index) => new Animated.Value(index === state.index ? 1 : 0)),
  ).current;

  useEffect(() => {
    Animated.timing(bubbleX, {
      toValue: centers[state.index],
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // SVG path/opacity props aren't guaranteed to be on the native-driver whitelist —
    // useNativeDriver: false here avoids a runtime warning, and a low-frequency
    // tab-switch fade has no meaningful perf cost running on the JS thread.
    hillOpacities.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: index === state.index ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index]);

  return (
    <View style={[styles.container, { height: totalHeight }]}>
      <Svg
        width={SCREEN_WIDTH}
        height={totalHeight + SVG_TOP_OVERFLOW}
        style={[styles.svg, { top: -SVG_TOP_OVERFLOW }]}
      >
        {state.routes.map((_, index) => (
          <AnimatedPath
            key={index}
            d={buildHillPath(SCREEN_WIDTH, totalHeight, centers[index])}
            fill={colors.surface}
            stroke={colors.border}
            strokeWidth={1}
            opacity={hillOpacities[index]}
          />
        ))}
      </Svg>

      <Animated.View
        style={[styles.bubble, { transform: [{ translateX: Animated.subtract(bubbleX, BUBBLE_SIZE / 2) }] }]}
      >
        <LinearGradient
          colors={BUBBLE_GRADIENTS[state.routes[state.index].name] ?? headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bubbleFill}
        >
          <FontAwesome6 name={ICONS[state.routes[state.index].name]} size={22} color="#FFFFFF" solid />
        </LinearGradient>
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
              {!isFocused ? <FontAwesome6 name={ICONS[route.name]} size={20} color={colors.textMuted} solid /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    // Bar shadow so it reads as a visually distinct raised surface in dark mode, where
    // colors.surface and colors.background are both very dark, low-contrast blues.
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 16 },
    }),
  },
  svg: { position: 'absolute', left: 0 },
  row: { flexDirection: 'row', height: BAR_HEIGHT },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bubble: {
    position: 'absolute',
    top: BUBBLE_TOP,
    left: 0,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  bubbleFill: {
    flex: 1,
    borderRadius: BUBBLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
