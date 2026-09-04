import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { headerGradient, useThemeColors } from '@/theme';
import { MainTabParamList } from '@/navigation/types';

// Ported verbatim from user-app's CustomTabBar (see its own doc comments for the full history
// of why each constant/technique is what it is — the floating-pill-with-inline-dot design was
// earned over many iterations there) — per explicit follow-up feedback that this app's tab bar
// should look the same as the main consumer app's, not the plain default bottom-tabs bar.
const MARGIN_H = 18;
const BAR_PADDING_H = 5;
const BAR_HEIGHT = 66;
const BAR_RADIUS = BAR_HEIGHT / 2;

const DOT_SIZE = 6;
const DOT_MARGIN_TOP = -2;

const ICON_BG_SIZE = 40;

const ICONS: Record<keyof MainTabParamList, React.ComponentProps<typeof FontAwesome6>['name']> = {
  Home: 'house',
  Bookings: 'calendar-check',
  Earnings: 'wallet',
  Profile: 'user',
};

// user-app's tab bar varies this per route (Bazaar gets its own orange); this app has no
// per-tab color identity — every tab, including registration, already resolved to the same
// brand-blue `headerGradient` (see BusinessRegistrationScreen's own follow-up fix) — so every
// tab here just uses the one constant gradient.
const ACTIVE_GRADIENT = headerGradient;

/**
 * Custom bottom tab bar: a floating rounded card where the active tab is marked by a small
 * gradient dot sitting inside the bar, just below its icon. See user-app's CustomTabBar for
 * the full design rationale (this is a direct port, generalized only insofar as this app has
 * one gradient for every tab instead of a per-route map) — any future fix or refinement here
 * should be checked against that version too, since there's no shared package between the
 * two apps.
 */
export function CustomTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors } = useThemeColors();
  const progressAnims = useRef(
    state.routes.map((_, index) => new Animated.Value(index === state.index ? 1 : 0)),
  ).current;
  const popScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    popScale.setValue(0.7);
    Animated.spring(popScale, {
      toValue: 1,
      friction: 5,
      tension: 180,
      useNativeDriver: true,
    }).start();

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
          const gradient = ACTIVE_GRADIENT;
          const iconName = ICONS[route.name as keyof MainTabParamList];
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
                      <FontAwesome6 name={iconName} size={20} color={colors.textMuted} solid />
                    </Animated.View>
                    <Animated.View
                      style={[
                        StyleSheet.absoluteFill,
                        styles.iconOverlayCenter,
                        { opacity: progress, transform: [{ scale: iconScale }] },
                      ]}
                    >
                      <FontAwesome6 name={iconName} size={20} color={gradient[0]} solid />
                    </Animated.View>
                  </View>
                </Animated.View>

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
