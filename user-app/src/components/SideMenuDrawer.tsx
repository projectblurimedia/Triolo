import React, { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, typography, useThemeColors } from '@/theme';

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

  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]} />
        </Pressable>

        <Animated.View style={[styles.drawer, { backgroundColor: colors.surface, transform: [{ translateX }] }]}>
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { paddingTop: insets.top + 14 }]}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <FontAwesome6 name={icon} size={26} color={colors.white} solid />
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
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.2, shadowRadius: 20 },
      android: { elevation: 20 },
    }),
  },
  header: { paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  headerText: { marginLeft: 12, flex: 1 },
  headerTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', lineHeight: 20 },
  headerSubtitle: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 14, marginTop: 2 },
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
