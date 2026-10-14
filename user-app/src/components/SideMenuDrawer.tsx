import React, { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Dimensions, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, typography, useThemeColors } from '@/theme';
import { GlassBackdropLayer, GlassFill } from './Glass';
import { Portal } from './Portal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.85;
const ICON_BUTTON_SIZE = 40;

interface SideMenuDrawerProps {
  visible: boolean;
  onClose: () => void;
  /** The same two-stop gradient the tab's own header uses. */
  gradient: readonly [string, string];
  /** Decorative brand icon beside the title, matching the tab's own leadingIcon. */
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  title: string;
  subtitle: string;
}

/**
 * Shared right-side drawer shell — the exact chrome/slide-in behavior `HomeMenuModal`
 * pioneered (gradient header with a brand icon + title/subtitle + close button, fixed-
 * duration timing for both open and close so the Modal reliably frees up touches, a
 * scrollable body) — extracted once a second and third tab needed the identical
 * interaction pattern (`ServicesMenuDrawer`, `BazaarMenuDrawer`), so it isn't tripled.
 * `HomeMenuModal` itself keeps its own inline implementation rather than adopting this
 * shell — its body mixes plain nav rows with settings rows (dynamic "current value"
 * subtitles) and a distinct red logout button/footer, a different enough shape that
 * forcing it through a generic `children` slot wouldn't simplify it, and it's already
 * shipped, working code not worth the regression risk to rewire for its own sake.
 */
export function SideMenuDrawer({
  visible,
  onClose,
  gradient,
  icon,
  title,
  subtitle,
  children,
}: PropsWithChildren<SideMenuDrawerProps>) {
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!rendered) return;
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : DRAWER_WIDTH,
        duration: visible ? 280 : 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 280 : 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!visible && finished) {
        setRendered(false);
      }
    });
  }, [visible, rendered]);

  // No native Modal, so the hardware back button is handled here.
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!rendered) return null;

  return (
    // Rendered in the app's own window (not a native Modal), so the glass panel can really
    // blur the tab screen behind it on Android — see Portal.tsx.
    <Portal>
      <View style={StyleSheet.absoluteFill}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
            <GlassBackdropLayer />
          </Animated.View>
        </Pressable>

        <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
          <GlassFill />
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={[styles.headerRow, { paddingTop: insets.top + 14 }]}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIcon}>
                  <FontAwesome6 name={icon} size={22} color={colors.white} solid />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {subtitle}
                  </Text>
                </View>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
                <FontAwesome6 name="xmark" size={18} color={colors.white} solid />
              </Pressable>
            </View>
            <View style={styles.accent} />
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>
        </Animated.View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    overflow: 'hidden',
    // iOS shadow only: Android elevation shows through translucent glass as a grey box.
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  header: { paddingHorizontal: 16 },
  // Same measurements as GradientHeader (46px row, 16px bottom padding, 3px accent line), so the
  // drawer's header lines up exactly with the screen header beside it.
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46, paddingBottom: 16, boxSizing: 'content-box' },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accent: { height: 3, marginHorizontal: -16, backgroundColor: 'rgba(255, 255, 255, 0.28)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  headerText: { marginLeft: 12, flex: 1 },
  headerTitle: {
    ...typography.heading,
    fontFamily: fonts.semiBold,
    fontSize: typography.heading.fontSize - 2,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  headerSubtitle: { ...typography.caption, color: 'rgba(255, 255, 255, 0.82)', lineHeight: 14, marginTop: 1.5 },
  closeButton: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: ICON_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: { padding: 16, paddingBottom: 32 },
});
