import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { headerGradient, useThemeColors } from '@/theme';
import { SHOP_GRADIENT } from './BusinessProfileModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_HEIGHT = 64;
const BAR_RADIUS = 16;
const BUBBLE_SIZE = 54;
const BUBBLE_RADIUS = BUBBLE_SIZE / 2;
// How far the bubble's top edge sits above the bar's own flat top edge (y=0). The bar
// itself is a plain flat rounded-rectangle — it never changes shape per selected tab — so
// the bubble simply overlaps directly on top of it (overlapIntoBar = BUBBLE_SIZE - POKE,
// currently 26px) instead of sitting in a cutout or a separately-shaped bump. This
// replaced two earlier designs (a concave notch cut into the bar, then a raised bezier
// "hill" bump requiring the bar's own SVG path to animate per tab) that both rendered
// visually disconnected from the flat icon row on a real device — confirmed the served
// bundle did contain the intended code both times, ruling out a stale-bundle explanation,
// which pointed at the per-tab animated bar *shape* (and, for the hill version, the taller
// container) as the actual source of the bug rather than anything geometry-specific. A
// plain flat bar + an overlapping circle needs neither: the bar's own box never changes
// size or shape, and the bubble's "poke above via negative top" positioning is the same
// mechanism already proven to render correctly throughout every earlier version of this
// component (only the bar's own per-tab-animated shape was ever the problem).
const BUBBLE_POKE = 28;
const BUBBLE_TOP = -BUBBLE_POKE;

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
 * Custom bottom tab bar: a plain flat bar (rounded top corners only, fixed shape — never
 * animated per tab) with a circular "bubble" holding the active tab's icon sliding
 * horizontally along it, overlapping directly on top rather than sitting in any per-tab
 * cutout or bump. This is deliberately simpler than earlier versions of this component
 * (a concave notch, then a raised bezier hill, both requiring the bar's own SVG shape to
 * animate per selected tab) after both repeatedly rendered visually disconnected from the
 * icon row on a real device despite mathematically-verified-correct geometry — see
 * docs/changelog.md. The bubble's own `translateX` is a plain numeric `Animated.Value`,
 * the same mechanism already proven to render correctly across every earlier iteration.
 */
export function CustomTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors } = useThemeColors();
  const tabCount = state.routes.length;
  const tabWidth = SCREEN_WIDTH / tabCount;
  const centers = state.routes.map((_, index) => tabWidth * index + tabWidth / 2);
  const totalHeight = BAR_HEIGHT + insets.bottom;

  const bubbleX = useRef(new Animated.Value(centers[state.index])).current;

  useEffect(() => {
    Animated.timing(bubbleX, {
      toValue: centers[state.index],
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index]);

  return (
    <View style={[styles.container, { height: totalHeight }]}>
      <View
        style={[
          styles.bar,
          { height: totalHeight, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      />

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
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BAR_RADIUS,
    borderTopRightRadius: BAR_RADIUS,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
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
