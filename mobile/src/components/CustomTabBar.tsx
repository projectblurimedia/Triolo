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
const BAR_RADIUS = 26;
const BUBBLE_SIZE = 54;
const BUBBLE_RADIUS = BUBBLE_SIZE / 2;
// The notch's own "radius" is derived from the bubble's, not an independent magic
// number — so the socket the bubble sits in is actually proportioned to match it,
// instead of two unrelated shapes that happen to overlap. GAP_RING is the visible ring
// of bar surface left between the bubble's edge and the notch's edge.
const GAP_RING = 6;
const NOTCH_RADIUS = BUBBLE_RADIUS + GAP_RING;
const NOTCH_WIDTH = NOTCH_RADIUS * 2.2;
const NOTCH_DEPTH = NOTCH_RADIUS;
// Bubble's center sits right at the bar's top edge (y=0) — it pokes up by exactly its own
// radius, noticeably less than an earlier pass that floated it much higher above the bar.
const BUBBLE_TOP = -BUBBLE_RADIUS;

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
 * SVG shape replaced the default @react-navigation rendering) and a smooth dip ("notch")
 * centered at `cx`, sized to cradle the floating bubble.
 */
function buildNotchPath(width: number, totalHeight: number, cx: number): string {
  const leftX = cx - NOTCH_WIDTH / 2;
  const rightX = cx + NOTCH_WIDTH / 2;
  return [
    `M0,${BAR_RADIUS}`,
    `A${BAR_RADIUS},${BAR_RADIUS} 0 0,1 ${BAR_RADIUS},0`,
    `L${leftX},0`,
    `C${leftX + NOTCH_WIDTH * 0.25},0 ${cx - NOTCH_WIDTH * 0.35},${NOTCH_DEPTH} ${cx},${NOTCH_DEPTH}`,
    `C${cx + NOTCH_WIDTH * 0.35},${NOTCH_DEPTH} ${rightX - NOTCH_WIDTH * 0.25},0 ${rightX},0`,
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
  const centers = state.routes.map((_, index) => tabWidth * index + tabWidth / 2);
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
  container: { position: 'relative' },
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
