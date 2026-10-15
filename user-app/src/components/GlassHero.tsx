import React, { PropsWithChildren, ReactNode, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts, headerGradient, typography } from '@/theme';
import { BlurTargetView, BlurView } from 'expo-blur';
import { ANDROID_REAL_BLUR } from '@/state/blurTargetStore';
import { useThemeColors } from '@/theme';
import { GlassPanel } from './GlassPanel';

/**
 * The frosted-glass top of a profile page (worker, shop, person looking for work): soft brand
 * colour blobs, really blurred behind a translucent pane, with the content in theme text colours
 * on top — the tab bar's glass, used for a whole header instead of a flat blue gradient.
 *
 * Android 12+ blurs the blobs through a BlurTargetView kept beside (never around) the pane;
 * older Android shows the blobs under a heavier frosted tint; iOS blurs natively.
 */

const IOS_BLUR_INTENSITY = 80;
const ANDROID_BLUR_INTENSITY = 32;
// Strong blur (radius = intensity / reduction) so the blobs melt into a soft wash of colour.
const ANDROID_BLUR_REDUCTION = 0.3;

interface GlassHeroProps {
  /** Room for the status bar when the hero sits at the very top of the screen. */
  topInset?: number;
  topLeft?: ReactNode;
  topRight?: ReactNode;
  /** A slim single row (header bar size) instead of the centred, stacked layout. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Colours for text and controls that sit on the glass hero. */
export function useGlassHeroColors() {
  const { colors, isDark } = useThemeColors();
  return {
    text: colors.text,
    muted: colors.textMuted,
    chipFill: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.62)',
    chipBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.9)',
    // Round buttons on the glass: frosted fill and a rim in the glass's own colours.
    buttonFill: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.72)',
    buttonBorder: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.95)',
    accent: colors.primary,
  };
}

export function GlassHero({
  topInset = 0,
  topLeft,
  topRight,
  compact = false,
  style,
  children,
}: PropsWithChildren<GlassHeroProps>) {
  const { isDark } = useThemeColors();
  const targetRef = useRef<View>(null);
  // The BlurView needs its target mounted first — switch it on after the first commit.
  const [targetReady, setTargetReady] = useState(false);
  useEffect(() => {
    if (targetRef.current && !targetReady) setTargetReady(true);
  });

  const androidBlur = Platform.OS === 'android' && ANDROID_REAL_BLUR && targetReady;
  const blurred = Platform.OS === 'ios' || androidBlur;
  const tint = isDark
    ? blurred
      ? 'rgba(14, 18, 26, 0.45)'
      : 'rgba(14, 18, 26, 0.82)'
    : blurred
      ? 'rgba(248, 251, 255, 0.42)'
      : 'rgba(248, 251, 255, 0.8)';

  const blobs = (
    <>
      <View style={[styles.blob, styles.blobBlue]} />
      <View style={[styles.blob, styles.blobViolet]} />
      <View style={[styles.blob, styles.blobCyan]} />
    </>
  );

  return (
    <View style={[styles.hero, compact ? styles.heroCompact : null, { paddingTop: topInset + (compact ? 14 : 16) }, style]}>
      {ANDROID_REAL_BLUR ? (
        <BlurTargetView ref={targetRef} style={StyleSheet.absoluteFill} pointerEvents="none">
          {blobs}
        </BlurTargetView>
      ) : (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {blobs}
        </View>
      )}
      {Platform.OS === 'ios' ? (
        <BlurView intensity={IOS_BLUR_INTENSITY} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      ) : androidBlur ? (
        <BlurView
          blurTarget={targetRef}
          blurMethod="dimezisBlurViewSdk31Plus"
          intensity={ANDROID_BLUR_INTENSITY}
          blurReductionFactor={ANDROID_BLUR_REDUCTION}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} pointerEvents="none" />
      <View style={[styles.hairline, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,85,211,0.12)' }]} />

      {topLeft || topRight ? (
        <View style={styles.topRow}>
          {topLeft ?? <View />}
          {topRight ?? null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    alignItems: 'center',
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  blob: { position: 'absolute', borderRadius: 999 },
  blobBlue: { width: 260, height: 260, top: -90, left: -70, backgroundColor: 'rgba(0, 85, 211, 0.55)' },
  blobViolet: { width: 220, height: 220, top: -40, right: -80, backgroundColor: 'rgba(124, 58, 237, 0.42)' },
  blobCyan: { width: 200, height: 200, bottom: -110, left: 60, backgroundColor: 'rgba(14, 165, 233, 0.42)' },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1 },
  heroCompact: { alignItems: 'stretch', paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  topRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
});

/** A round frosted button for the glass header (back, favourite…), its rim in the glass's own colours. */
const ROSE_GRADIENT = ['#F43F5E', '#FB7185'] as const;

/**
 * A round button for the glass header (back, favourite): a brand-gradient circle with a white
 * icon, a white rim and a soft glow, so it stands out clearly on the light glass. `active`
 * turns it rose (a saved favourite).
 */
export function GlassHeroButton({
  icon,
  onPress,
  accessibilityLabel,
  active = false,
  solid = true,
  disabled,
}: {
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
  solid?: boolean;
  disabled?: boolean;
}) {
  const gradient = active ? ROSE_GRADIENT : headerGradient;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        compactStyles.buttonShadow,
        { shadowColor: gradient[0], transform: [{ scale: pressed ? 0.92 : 1 }] },
      ]}
    >
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={compactStyles.button}>
        <FontAwesome6 name={icon} size={16} color="#FFFFFF" solid={solid} />
      </LinearGradient>
    </Pressable>
  );
}

interface CompactHeaderProps {
  topInset: number;
  onBack: () => void;
  backLabel: string;
  avatar: ReactNode;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  titleLines?: number;
}

/**
 * A profile page with the bottom tab bar's glass for its header: a slim bar (back, photo, name,
 * one line, an optional button) floating over the page, which really blurs as it scrolls
 * underneath (Android 12+ through a BlurTargetView around the scroll content; iOS natively).
 */
export function GlassProfileLayout({
  topInset,
  onBack,
  backLabel,
  avatar,
  title,
  subtitle,
  right,
  titleLines = 1,
  contentContainerStyle,
  children,
}: PropsWithChildren<CompactHeaderProps & { contentContainerStyle?: StyleProp<ViewStyle> }>) {
  const { colors, isDark } = useThemeColors();
  const targetRef = useRef<View>(null);
  const [headerHeight, setHeaderHeight] = useState(topInset + 80);

  const scroll = (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[contentContainerStyle, { paddingTop: headerHeight + 16 }]}
    >
      {children}
    </ScrollView>
  );

  return (
    <View style={layoutStyles.fill}>
      {ANDROID_REAL_BLUR ? (
        <BlurTargetView ref={targetRef} style={layoutStyles.fill}>
          {scroll}
        </BlurTargetView>
      ) : (
        <View ref={targetRef} style={layoutStyles.fill}>
          {scroll}
        </View>
      )}
      <View style={layoutStyles.header} onLayout={(event) => setHeaderHeight(Math.round(event.nativeEvent.layout.height))}>
        <GlassPanel blurTarget={targetRef} bordered={false} style={[layoutStyles.panel, { paddingTop: topInset + 12 }]}>
          <View style={compactStyles.row}>
            <GlassHeroButton icon="chevron-left" onPress={onBack} accessibilityLabel={backLabel} />
            <View
              style={[
                compactStyles.avatarRing,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)',
                  borderColor: `${colors.primary}26`,
                },
              ]}
            >
              {avatar}
            </View>
            <View style={compactStyles.text}>
              <Text style={[compactStyles.title, { color: colors.text }]} numberOfLines={titleLines}>
                {title}
              </Text>
              {typeof subtitle === 'string' ? (
                <Text style={[compactStyles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : (
                subtitle
              )}
            </View>
            {right}
          </View>
        </GlassPanel>
        <View style={[layoutStyles.hairline, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,85,211,0.10)' }]} />
      </View>
    </View>
  );
}

const layoutStyles = StyleSheet.create({
  fill: { flex: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
  panel: { paddingHorizontal: 16, paddingBottom: 14 },
  hairline: { height: StyleSheet.hairlineWidth },
});

export const COMPACT_AVATAR_SIZE = 48;

const compactStyles = StyleSheet.create({
  buttonShadow: {
    borderRadius: 22,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarRing: { padding: 2, borderRadius: COMPACT_AVATAR_SIZE / 2 + 3, borderWidth: 1 },
  text: { flex: 1 },
  title: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 23 },
  subtitle: { ...typography.caption, fontSize: 12, marginTop: 1 },
});
