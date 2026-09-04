import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/state/toastStore';
import { colors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

const DISPLAY_DURATION = 3200;
const ANIM_DURATION = 260;

const VARIANT_CONFIG = {
  success: { gradient: [colors.success, '#0F7A37'] as const, icon: 'circle-check' as const },
  error: { gradient: ['#ef4444', '#dc2626'] as const, icon: 'circle-exclamation' as const },
  info: { gradient: headerGradient, icon: 'circle-info' as const },
};

/**
 * App-wide replacement for Alert.alert — rendered once at the root (App.tsx, alongside
 * LogoutOverlay) and driven by toastStore so any screen/mutation can call showToast()
 * without needing a Provider or prop-drilled dismiss handler. Only one toast shows at a
 * time (a new one replaces whatever's showing), matching Alert's own one-at-a-time
 * behavior — this app has no need for a stacked queue.
 */
export function ToastHost() {
  const toast = useToastStore((state) => state.toast);
  const hideToast = useToastStore((state) => state.hideToast);
  const { colors: themeColors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: ANIM_DURATION, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: ANIM_DURATION, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        hideToast();
      }
    });
  };

  useEffect(() => {
    if (!toast) {
      return;
    }

    translateY.setValue(-120);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: ANIM_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: ANIM_DURATION, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(dismiss, DISPLAY_DURATION);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  if (!toast) {
    return null;
  }

  const config = VARIANT_CONFIG[toast.variant];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.container, { top: insets.top + 10, transform: [{ translateY }], opacity }]}
    >
      <Pressable onPress={dismiss} style={[styles.card, { backgroundColor: themeColors.surface }]}>
        <LinearGradient colors={config.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconCircle}>
          <FontAwesome6 name={config.icon} size={17} color="#FFFFFF" solid />
        </LinearGradient>
        <View style={styles.textGroup}>
          <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
            {toast.title}
          </Text>
          {toast.message ? (
            <Text style={[styles.message, { color: themeColors.textMuted }]} numberOfLines={2}>
              {toast.message}
            </Text>
          ) : null}
        </View>
        <View style={[styles.accentBar, { backgroundColor: config.gradient[0] }]} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: { flex: 1 },
  title: { ...typography.body, fontFamily: fonts.semiBold },
  message: { ...typography.caption, marginTop: 2 },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
});
