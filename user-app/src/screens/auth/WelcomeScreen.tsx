import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '@/components/Button';
import { LanguagePickerModal } from '@/components/LanguagePickerModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

const FEATURES: { icon: IconName; key: string; tint: string }[] = [
  { icon: 'screwdriver-wrench', key: 'workers', tint: '#0055D3' },
  { icon: 'basket-shopping', key: 'shops', tint: '#16A34A' },
  { icon: 'location-crosshairs', key: 'tracking', tint: '#7C3AED' },
];

// The services that circle the Create Account button.
const ORBIT: { icon: IconName; tint: string }[] = [
  { icon: 'bolt', tint: '#F59E0B' },
  { icon: 'faucet', tint: '#0EA5E9' },
  { icon: 'paint-roller', tint: '#EC4899' },
  { icon: 'store', tint: '#16A34A' },
  { icon: 'hammer', tint: '#7C3AED' },
  { icon: 'wrench', tint: '#0055D3' },
  { icon: 'broom', tint: '#14B8A6' },
  { icon: 'basket-shopping', tint: '#EF4444' },
];
const ORBIT_SECONDS = 26;
const BUBBLE = 44;

/**
 * The first screen of the customer app. Every self-registered account is just a `user` —
 * Worker/Business live in the Partner app (see .cloud/project-context.md's "Account Model") —
 * so there is one "Create Account" entry point, not a role picker.
 *
 * A compact header (logo above the script app name, centred, then the headline), a ring of
 * service icons slowly circling a "help near you" badge, Create Account and Log In below it, then a short plain list of what the app
 * does (information only, not tappable).
 */
export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: ORBIT_SECONDS * 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  // Each icon turns back the other way so it stays upright while it travels round.
  const counterRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const size = Math.min(width - 40, 300);
  const radius = size / 2 - BUBBLE / 2 - 4;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 14 }]}
        >
          <View style={[styles.blob, styles.blobOne]} />
          <View style={[styles.blob, styles.blobTwo]} />

          <Pressable
            style={[styles.languageButton, { top: insets.top + 14 }]}
            onPress={() => setLanguagePickerVisible(true)}
            accessibilityLabel={t('settings.language')}
            hitSlop={8}
          >
            <FontAwesome6 name="language" size={16} color="#FFFFFF" solid />
          </Pressable>

          <View style={styles.brandIcon}>
            <FontAwesome6 name="shapes" size={24} color="#0055D3" solid />
          </View>
          <Text style={styles.brandText}>{t('common.appName')}</Text>
          <Text style={styles.headline} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {t('welcome.headline')}
          </Text>
          <Text style={styles.subline}>{t('welcome.subline')}</Text>
        </LinearGradient>

        <View style={styles.orbitWrap}>
          <View style={{ width: size, height: size }}>
            <View
              style={[
                styles.ring,
                { width: radius * 2, height: radius * 2, borderRadius: radius, left: size / 2 - radius, top: size / 2 - radius },
                { borderColor: `${colors.primary}30` },
              ]}
            />
            <View
              style={[
                styles.glow,
                { width: size * 0.56, height: size * 0.56, borderRadius: size * 0.28, left: size * 0.22, top: size * 0.22 },
                { backgroundColor: `${colors.primary}0F` },
              ]}
            />
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
              {ORBIT.map((item, index) => {
                const angle = (index / ORBIT.length) * 2 * Math.PI;
                return (
                  <Animated.View
                    key={item.icon}
                    style={[
                      styles.bubble,
                      {
                        left: size / 2 + radius * Math.cos(angle) - BUBBLE / 2,
                        top: size / 2 + radius * Math.sin(angle) - BUBBLE / 2,
                        backgroundColor: colors.surface,
                        borderColor: `${item.tint}55`,
                        transform: [{ rotate: counterRotate }],
                      },
                    ]}
                  >
                    <FontAwesome6 name={item.icon} size={17} color={item.tint} solid />
                  </Animated.View>
                );
              })}
            </Animated.View>
            <View style={styles.center} pointerEvents="none">
              <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.centerBadge}>
                <FontAwesome6 name="house-circle-check" size={22} color="#FFFFFF" solid />
              </LinearGradient>
              <Text style={[styles.centerTitle, { color: colors.text }]}>{t('welcome.centerTitle')}</Text>
              <Text style={[styles.centerText, { color: colors.textMuted }]}>{t('welcome.centerText')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Button label={t('auth.createAccount')} onPress={() => navigation.navigate('Register')} />
          <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} style={styles.loginRow}>
            <Text style={[styles.loginPrompt, { color: colors.textMuted }]}>
              {t('auth.alreadyHaveAccount')} <Text style={[styles.loginLink, { color: colors.primary }]}>{t('auth.login')}</Text>
            </Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('welcome.featuresTitle')}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>
          {FEATURES.map((feature) => (
            <View key={feature.key} style={styles.feature}>
              <View style={[styles.featureIcon, { backgroundColor: `${feature.tint}1A` }]}>
                <FontAwesome6 name={feature.icon} size={15} color={feature.tint} solid />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>{t(`welcome.features.${feature.key}.title`)}</Text>
                <Text style={[styles.featureSubtitle, { color: colors.textMuted }]}>
                  {t(`welcome.features.${feature.key}.subtitle`)}
                </Text>
              </View>
            </View>
          ))}

          <View style={styles.trustRow}>
            {(['shield-halved', 'star', 'language'] as const).map((icon, index) => (
              <View key={icon} style={styles.trust}>
                <FontAwesome6 name={icon} size={12} color={colors.primary} solid />
                <Text style={[styles.trustText, { color: colors.textMuted }]}>{t(`welcome.trust.${index}`)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <LanguagePickerModal visible={languagePickerVisible} onClose={() => setLanguagePickerVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 22,
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)' },
  blobOne: { width: 220, height: 220, top: -90, right: -70 },
  blobTwo: { width: 140, height: 140, bottom: -60, left: -40 },
  languageButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  brandText: {
    color: '#FFFFFF',
    fontFamily: fonts.brand,
    fontSize: 46,
    lineHeight: 56,
    marginTop: 4,
    paddingHorizontal: 6,
    // The script face has no bold weight; a tight same-colour shadow thickens the strokes a little.
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 0.7, height: 0 },
    textShadowRadius: 1,
  },
  headline: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 18, lineHeight: 25, marginTop: 8, textAlign: 'center' },
  subline: {
    ...typography.caption,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 2,
    lineHeight: 18,
    textAlign: 'center',
  },
  orbitWrap: { alignItems: 'center', paddingTop: 14 },
  ring: { position: 'absolute', borderWidth: 1.5, borderStyle: 'dashed' },
  glow: { position: 'absolute' },
  bubble: {
    position: 'absolute',
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B2A5B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  centerBadge: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  centerTitle: { ...typography.body, fontFamily: fonts.semiBold, marginTop: 8 },
  centerText: { ...typography.caption, fontSize: 11.5, textAlign: 'center', maxWidth: 140 },
  actions: { paddingHorizontal: 20, paddingTop: 6 },
  loginRow: { alignItems: 'center', marginTop: 14 },
  loginPrompt: { ...typography.body },
  loginLink: { fontFamily: fonts.semiBold },
  body: { paddingHorizontal: 20, paddingTop: 22 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  sectionTitle: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  featureIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  featureText: { flex: 1 },
  featureTitle: { ...typography.body, fontFamily: fonts.semiBold },
  featureSubtitle: { ...typography.caption, marginTop: 2, lineHeight: 17 },
  trustRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingHorizontal: 4 },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { ...typography.caption, fontSize: 11.5 },
});
