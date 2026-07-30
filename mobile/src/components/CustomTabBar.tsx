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
// The selected tab's colored circle sits entirely within the bar's own row height (never
// poking above the bar) — three earlier designs each had some element (a notch, a bezier
// hill, a same-color hidden circle) rising above the bar's flat top edge, and every one of
// them rendered visually disconnected/floating on a real device despite verified-correct
// geometry and confirmed-current bundles. Keeping every element fully inside the row's own
// bounds removes any possibility of that class of bug — the icon and its circle are just
// ordinary flex-row content now, not an absolutely-positioned overlay reaching outside it.
const PILL_SIZE = 48;
const PILL_RADIUS = PILL_SIZE / 2;

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

/**
 * Custom bottom tab bar: a plain flat bar (rounded top corners, fixed shape) with every
 * icon sitting in one ordinary row at the same height — the selected tab gets a sliding
 * colored circle directly behind its icon, sized to fit entirely within the row's own
 * bounds. This is deliberately conservative after three earlier designs (a concave notch,
 * a bezier hill bump, a same-color hidden circle) each had some element poking above the
 * bar's own flat top edge and each rendered visually disconnected from the row on a real
 * device — see docs/changelog.md. Nothing here is positioned outside the row's own box, so
 * that entire class of bug can't recur.
 */
export function CustomTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors } = useThemeColors();
  const tabCount = state.routes.length;
  const tabWidth = SCREEN_WIDTH / tabCount;
  const centers = state.routes.map((_, index) => tabWidth * index + tabWidth / 2);
  const totalHeight = BAR_HEIGHT + insets.bottom;

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
    <View
      style={[
        styles.container,
        { height: totalHeight, backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Animated.View
        style={[styles.pill, { transform: [{ translateX: Animated.subtract(pillX, PILL_RADIUS) }] }]}
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
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderTopLeftRadius: BAR_RADIUS,
    borderTopRightRadius: BAR_RADIUS,
    borderWidth: 1,
    borderBottomWidth: 0,
    // Bar shadow so it reads as a visually distinct raised surface in dark mode, where
    // colors.surface and colors.background are both very dark, low-contrast blues.
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 16 },
    }),
  },
  row: { flexDirection: 'row', height: BAR_HEIGHT },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: {
    position: 'absolute',
    top: (BAR_HEIGHT - PILL_SIZE) / 2,
    left: 0,
    width: PILL_SIZE,
    height: PILL_SIZE,
    borderRadius: PILL_RADIUS,
  },
  pillFill: {
    flex: 1,
    borderRadius: PILL_RADIUS,
  },
});
