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
const BUBBLE_SIZE = 48;
const BUBBLE_RADIUS = BUBBLE_SIZE / 2;
// A wide, shallow-cornered "smile" notch — a symmetric cubic-bezier S-curve per side,
// each leaving the flat bar horizontally and arriving at the dip's bottom horizontally
// (both tangents are 0, so the whole dip is one continuous curve with no kink at the
// midpoint either). This replaced an earlier design that matched the notch's curvature
// tightly to the bubble's own radius via a true circular arc — that was geometrically
// smooth too, but read as a narrow dimple hidden mostly behind the bubble rather than a
// wide, visibly-rounded scoop cradling it (confirmed by rendering both to a PNG via a
// headless browser and comparing side by side — see docs/changelog.md). NOTCH_DEPTH is
// tied to BUBBLE_RADIUS (not independently tuned) so the bubble nests almost exactly to
// the scoop's own floor rather than floating above it or poking out the bottom.
const NOTCH_HALF_WIDTH = 40;
const NOTCH_DEPTH = BUBBLE_RADIUS + 8;
const CURVE_REACH = 22;
// The minimum distance the notch's (and bubble's) center can sit from either screen edge
// before the notch's shoulders would run past the bar's own rounded corner. This engages
// on the edge tabs (Home/Profile) at narrow widths — clampCenter is applied to BOTH the
// notch and the bubble's translateX identically, so they never visually separate even
// when clamped; the tradeoff is the bubble sitting a few px off its tab's true geometric
// center on the narrowest realistic screens (~13px at 360dp), which reads as invisible
// next to a scoop that's visibly off-center from the bubble sitting in it.
const MIN_NOTCH_MARGIN = BAR_RADIUS + NOTCH_HALF_WIDTH + 2;
// How far the bubble pokes above the bar's flat top edge (y=0). Chosen so the bubble's
// own bottom edge clears the notch's floor (NOTCH_DEPTH) by a visible ~10px gap — at the
// previous, shallower poke the bubble's bottom actually extended past the notch floor,
// which (both being the same fill color) read as the bubble sitting fused/attached to the
// bar rather than floating above it. Still well under the "poke = full radius" range an
// earlier pass already rejected as floating too high.
const BUBBLE_POKE = 26;
const BUBBLE_TOP = -BUBBLE_POKE;

/**
 * Keeps the notch center (and, identically, the bubble's) from ever running past the
 * bar's rounded corner, regardless of screen width.
 */
function clampNotchCenter(cx: number, width: number): number {
  return Math.min(Math.max(cx, MIN_NOTCH_MARGIN), width - MIN_NOTCH_MARGIN);
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
 * A bar shape with rounded top corners (matching what the tab bar had before this custom
 * SVG shape replaced the default @react-navigation rendering) and a wide, smoothly-rounded
 * dip ("notch") centered at the already-clamped `cx`. Each side of the dip is a single
 * cubic bezier that starts horizontal (matching the flat bar's own tangent) and ends
 * horizontal (matching the flat floor at the dip's center) — both tangents being zero is
 * what makes the whole dip read as one continuous rounded scoop rather than two curves
 * meeting at a visible kink.
 */
function buildNotchPath(width: number, totalHeight: number, cx: number): string {
  const leftX = cx - NOTCH_HALF_WIDTH;
  const rightX = cx + NOTCH_HALF_WIDTH;
  const a = CURVE_REACH;
  return [
    `M0,${BAR_RADIUS}`,
    `A${BAR_RADIUS},${BAR_RADIUS} 0 0,1 ${BAR_RADIUS},0`,
    `L${leftX},0`,
    `C${leftX + a},0 ${cx - a},${NOTCH_DEPTH} ${cx},${NOTCH_DEPTH}`,
    `C${cx + a},${NOTCH_DEPTH} ${rightX - a},0 ${rightX},0`,
    `L${width - BAR_RADIUS},0`,
    `A${BAR_RADIUS},${BAR_RADIUS} 0 0,1 ${width},${BAR_RADIUS}`,
    `L${width},${totalHeight}`,
    `L0,${totalHeight}`,
    `Z`,
  ].join(' ');
}

/**
 * Custom bottom tab bar: a floating circular "bubble" holding the active tab's icon sits
 * in a smooth SVG notch that slides to whichever tab is selected, instead of a flat bar
 * with a plain icon+label per tab. React Native's Animated can't smoothly interpolate
 * between two arbitrary SVG path strings, so each tab's notch path is precomputed once
 * (there are only 4, fixed by tab count) and cross-faded via opacity; the bubble's own
 * `translateX` is a plain numeric Animated.Value, which *can* animate continuously.
 */
export function CustomTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors } = useThemeColors();
  const tabCount = state.routes.length;
  const tabWidth = SCREEN_WIDTH / tabCount;
  // Clamped up front so the notch and the bubble (which shares this same array for its
  // translateX target) are always visually locked together — see clampNotchCenter's doc.
  const centers = state.routes.map((_, index) =>
    clampNotchCenter(tabWidth * index + tabWidth / 2, SCREEN_WIDTH),
  );
  const totalHeight = BAR_HEIGHT + insets.bottom;

  const bubbleX = useRef(new Animated.Value(centers[state.index])).current;
  const notchOpacities = useRef(
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
    notchOpacities.forEach((anim, index) => {
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
      <Svg width={SCREEN_WIDTH} height={totalHeight} style={styles.svg}>
        {state.routes.map((_, index) => (
          <AnimatedPath
            key={index}
            d={buildNotchPath(SCREEN_WIDTH, totalHeight, centers[index])}
            fill={colors.surface}
            stroke={colors.border}
            strokeWidth={1}
            opacity={notchOpacities[index]}
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
          <FontAwesome6 name={ICONS[state.routes[state.index].name]} size={20} color="#FFFFFF" solid />
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
    // Restores the shadow the original tab bar had (dropped when it was rebuilt as a
    // custom SVG shape) — without it, the bar reads as barely distinct from the screen
    // background in dark mode (colors.surface and colors.background are both very dark,
    // low-contrast blues), which made the notch curve underneath the bubble hard to see
    // regardless of how correct its geometry was.
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 16 },
    }),
  },
  svg: { position: 'absolute', top: 0, left: 0 },
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
