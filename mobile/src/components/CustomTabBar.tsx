import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FontAwesome6 } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useThemeColors } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_HEIGHT = 64;
const NOTCH_WIDTH = 78;
const BUBBLE_SIZE = 54;

const AnimatedPath = Animated.createAnimatedComponent(Path);

const ICONS: Record<string, React.ComponentProps<typeof FontAwesome6>['name']> = {
  Home: 'house',
  Services: 'screwdriver-wrench',
  Bazaar: 'store',
  Profile: 'user',
};

/** A bar shape that's flat everywhere except a smooth dip ("notch") centered at `cx`, sized to cradle the floating bubble. */
function buildNotchPath(width: number, barHeight: number, totalHeight: number, cx: number): string {
  const notchDepth = barHeight * 0.55;
  const leftX = cx - NOTCH_WIDTH / 2;
  const rightX = cx + NOTCH_WIDTH / 2;
  return [
    `M0,0`,
    `L${leftX},0`,
    `C${leftX + NOTCH_WIDTH * 0.25},0 ${cx - NOTCH_WIDTH * 0.35},${notchDepth} ${cx},${notchDepth}`,
    `C${cx + NOTCH_WIDTH * 0.35},${notchDepth} ${rightX - NOTCH_WIDTH * 0.25},0 ${rightX},0`,
    `L${width},0`,
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
            d={buildNotchPath(SCREEN_WIDTH, BAR_HEIGHT, totalHeight, centers[index])}
            fill={colors.surface}
            opacity={notchOpacities[index]}
          />
        ))}
      </Svg>

      <Animated.View
        style={[
          styles.bubble,
          { backgroundColor: colors.primary, transform: [{ translateX: Animated.subtract(bubbleX, BUBBLE_SIZE / 2) }] },
        ]}
      >
        <FontAwesome6 name={ICONS[state.routes[state.index].name]} size={20} color="#FFFFFF" solid />
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
    top: -18,
    left: 0,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
});
