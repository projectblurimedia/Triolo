import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { fonts, headerGradient, useThemeColors } from '@/theme';
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

// The selected tab expands into an icon+label capsule (sliding, spring-bounced into place)
// instead of a plain icon-only circle — a deliberately more premium, "alive" interaction
// than a static indicator, matching current top-tier app tab bars (Arc, Threads, various
// 2024+ fintech/wellness apps) rather than a plain dot/circle highlight. One fixed width
// comfortably fits the longest tab label ("Services") — every tab's capsule uses the same
// width rather than resizing per label, avoiding a jarring per-tab width animation. Sized
// (and the icon/gap/padding/font tuned down to fit) specifically so that even the
// longest-label tab, clamped to the narrowest supported edge position (see below), never
// overlaps the next tab's icon — verified by rendering the exact worst-case geometry
// (narrowest screen × longest label × edge tab) to a PNG before picking these numbers; an
// earlier, more spacious 116px version overlapped the neighboring tab's icon at common
// phone widths once actually checked.
const CAPSULE_WIDTH = 92;
const CAPSULE_HEIGHT = 42;
const CAPSULE_RADIUS = CAPSULE_HEIGHT / 2;
// The capsule is wider than a single tab's own flex slot at realistic phone widths (4 tabs
// leaves each slot ~90-107px), so the edge tabs (Home/Profile) need their capsule's center
// clamped inward — otherwise, at narrow widths, the capsule runs past the bar's own rounded
// corner and gets clipped by `glassClip`'s overflow:hidden. Same clamping pattern this
// component's earlier notch/hill designs relied on: only the capsule's own drawn position
// shifts — the underlying tab's tap target still spans its full, unclamped flex slot.
const MIN_CAPSULE_MARGIN = CAPSULE_WIDTH / 2 + BAR_RADIUS + 4;

function clampCapsuleCenter(cx: number, width: number): number {
  return Math.min(Math.max(cx, MIN_CAPSULE_MARGIN), width - MIN_CAPSULE_MARGIN);
}

const ICONS: Record<string, React.ComponentProps<typeof FontAwesome6>['name']> = {
  Home: 'house',
  Services: 'screwdriver-wrench',
  Bazaar: 'store',
  Profile: 'user',
};

// Bazaar's capsule matches its own established orange identity (SHOP_GRADIENT — same as
// its header, icon dock, and profile card); every other tab uses the constant brand blue.
const CAPSULE_GRADIENTS: Record<string, readonly [string, string]> = {
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
 * Custom bottom tab bar: an iOS-style floating glass pill (blurred, translucent, margin on
 * every side) with the selected tab expanding into an icon+label capsule that slides and
 * spring-bounces into place, instead of a static icon-only indicator — a deliberate step up
 * in polish after "outdated" feedback on the plain-circle version, on top of the same glass
 * foundation (blur, shine, floating overlay) that was already working. Replaces every
 * previous design of this component (a concave notch, a raised hill, a same-color hidden
 * circle, an in-row pill, a plain glass capsule) outright rather than iterating on any of
 * them. The capsule's horizontal slide still uses the same proven `translateX`-on-a-plain-
 * `Animated.Value` mechanism every earlier version of this component has used successfully;
 * only the entrance bounce (`Animated.spring`) and the icon+label content are new.
 */
export function CustomTabBar({ state, navigation, insets, blurTarget }: CustomTabBarProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useThemeColors();
  const tabCount = state.routes.length;
  const tabWidth = BAR_WIDTH / tabCount;
  // Clamped for the capsule's own sliding target — the underlying tab row below still uses
  // true, unclamped centers via normal flex layout, so tap targets are unaffected.
  const centers = state.routes.map((_, index) =>
    clampCapsuleCenter(tabWidth * index + tabWidth / 2, BAR_WIDTH),
  );

  const capsuleX = useRef(new Animated.Value(centers[state.index])).current;
  const capsuleScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(capsuleX, {
      toValue: centers[state.index],
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // A quick squash-then-spring-back on every tab change — this "bounce" is what makes
    // the capsule feel alive/premium rather than just sliding, without touching the
    // horizontal slide's own timing (which stays a smooth, predictable `timing`).
    capsuleScale.setValue(0.82);
    Animated.spring(capsuleScale, {
      toValue: 1,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index]);

  const labels: Record<string, string> = {
    Home: t('tabs.home'),
    Services: t('tabs.services'),
    Bazaar: t('tabs.bazaar'),
    Profile: t('tabs.profile'),
  };
  const activeRouteName = state.routes[state.index].name;
  const activeGradient = CAPSULE_GRADIENTS[activeRouteName] ?? headerGradient;

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
            style={[
              styles.capsule,
              // iOS-only colored glow, tinted to the active tab's own gradient — Android's
              // elevation shadow is always a plain dark tone regardless of shadowColor, so
              // this is a deliberate iOS-specific enhancement, not a cross-platform bug.
              Platform.OS === 'ios' ? { shadowColor: activeGradient[0] } : null,
              {
                transform: [
                  { translateX: Animated.subtract(capsuleX, CAPSULE_WIDTH / 2) },
                  { scale: capsuleScale },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={activeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.capsuleFill}
            >
              <FontAwesome6 name={ICONS[activeRouteName]} size={16} color="#FFFFFF" solid />
              <Text style={styles.capsuleLabel} numberOfLines={1}>
                {labels[activeRouteName]}
              </Text>
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
                  {/* The active tab's icon renders inside the capsule above instead —
                      this slot stays empty for it so nothing double-renders underneath. */}
                  {!isFocused ? (
                    <FontAwesome6 name={ICONS[route.name]} size={20} color={colors.textMuted} solid />
                  ) : null}
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
  capsule: {
    position: 'absolute',
    top: (BAR_HEIGHT - CAPSULE_HEIGHT) / 2,
    left: 0,
    width: CAPSULE_WIDTH,
    height: CAPSULE_HEIGHT,
    borderRadius: CAPSULE_RADIUS,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10 },
      android: { elevation: 8 },
    }),
  },
  capsuleFill: {
    flex: 1,
    borderRadius: CAPSULE_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 9,
  },
  capsuleLabel: {
    color: '#FFFFFF',
    fontFamily: fonts.semiBold,
    fontSize: 11.5,
  },
});
