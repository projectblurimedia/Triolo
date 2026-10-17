import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LanguagePickerModal } from '@/components/LanguagePickerModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

// The kinds of partner that circle the centre badge.
const ORBIT: { icon: IconName; tint: string }[] = [
  { icon: 'bolt', tint: '#F59E0B' },
  { icon: 'store', tint: '#16A34A' },
  { icon: 'faucet', tint: '#0EA5E9' },
  { icon: 'user-tie', tint: '#EC4899' },
  { icon: 'hammer', tint: '#7C3AED' },
  { icon: 'basket-shopping', tint: '#EF4444' },
  { icon: 'paint-roller', tint: '#14B8A6' },
  { icon: 'wrench', tint: '#0055D3' },
];
const ORBIT_SECONDS = 26;
const BUBBLE = 40;

/**
 * The Partner app's first screen — the same look as the customer app's Welcome (centred logo
 * and name, a slowly circling ring of icons) with partner touches: the centre shows "earn near
 * you" instead of a button, and the three ways to join (worker, shop, job seeker) follow as
 * cards. Each card opens its own one-form registration; Log In is below them.
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
  const size = Math.min(width - 60, 250);
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
            <FontAwesome6 name="handshake" size={24} color="#0055D3" solid />
          </View>
          <View style={styles.brandRow}>
            {/* Two pieces in the same script face: as one string the font drew only "Triolo" on some phones. */}
            <Text style={styles.brandText}>Triolo</Text>
            <Text style={styles.brandText}>{t('partnerWelcome.partnerTag')}</Text>
          </View>
          <Text style={styles.headline} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {t('partnerWelcome.headline')}
          </Text>
          <Text style={styles.subline}>{t('partnerWelcome.subline')}</Text>
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
                    <FontAwesome6 name={item.icon} size={15} color={item.tint} solid />
                  </Animated.View>
                );
              })}
            </Animated.View>
            <View style={styles.center} pointerEvents="none">
              <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.centerBadge}>
                <FontAwesome6 name="indian-rupee-sign" size={22} color="#FFFFFF" solid />
              </LinearGradient>
              <Text style={[styles.centerTitle, { color: colors.text }]}>{t('partnerWelcome.centerTitle')}</Text>
              <Text style={[styles.centerText, { color: colors.textMuted }]}>{t('partnerWelcome.centerText')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('partnerWelcome.joinAs')}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>
          <EntryCard
            icon="screwdriver-wrench"
            title={t('chooseCapability.workerUnregisteredTitle')}
            subtitle={t('chooseCapability.workerUnregisteredSubtitle')}
            colors={colors}
            onPress={() => navigation.navigate('RegisterWorker')}
          />
          <EntryCard
            icon="store"
            title={t('chooseCapability.businessUnregisteredTitle')}
            subtitle={t('chooseCapability.businessUnregisteredSubtitle')}
            colors={colors}
            onPress={() => navigation.navigate('RegisterBusiness')}
          />
          <EntryCard
            icon="user-tie"
            title={t('jobPost.lookingTitle')}
            subtitle={t('jobPost.lookingSubtitle')}
            colors={colors}
            onPress={() => navigation.navigate('RegisterJobSeeker')}
          />

          <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} style={styles.loginRow}>
            <Text style={[styles.loginPrompt, { color: colors.textMuted }]}>
              {t('auth.alreadyHaveAccount')} <Text style={[styles.loginLink, { color: colors.primary }]}>{t('auth.login')}</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <LanguagePickerModal visible={languagePickerVisible} onClose={() => setLanguagePickerVisible(false)} />
    </View>
  );
}

interface EntryCardProps {
  icon: IconName;
  title: string;
  subtitle: string;
  colors: ReturnType<typeof useThemeColors>['colors'];
  onPress: () => void;
}

function EntryCard({ icon, title, subtitle, colors, onPress }: EntryCardProps) {
  return (
    <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress}>
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardIcon}>
        <FontAwesome6 name={icon} size={19} color="#FFFFFF" solid />
      </LinearGradient>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.cardSubtitle, { color: colors.textMuted }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <View style={[styles.cardArrow, { backgroundColor: `${colors.primary}12` }]}>
        <FontAwesome6 name="arrow-right" size={13} color={colors.primary} solid />
      </View>
    </Pressable>
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
    fontSize: 44,
    lineHeight: 56,
    marginTop: 4,
    paddingHorizontal: 6,
    // The script face has no bold weight; a tight same-colour shadow thickens the strokes a little.
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 0.7, height: 0 },
    textShadowRadius: 1,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  headline: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 18, lineHeight: 25, marginTop: 8, textAlign: 'center' },
  subline: {
    ...typography.caption,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 2,
    lineHeight: 18,
    textAlign: 'center',
  },
  orbitWrap: { alignItems: 'center', paddingTop: 12 },
  ring: { position: 'absolute', borderWidth: 1.5, borderStyle: 'dashed' },
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
  centerBadge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  centerTitle: { ...typography.body, fontFamily: fonts.semiBold, marginTop: 8 },
  centerText: { ...typography.caption, fontSize: 11.5, textAlign: 'center', maxWidth: 130 },
  body: { paddingHorizontal: 20, paddingTop: 8 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  sectionTitle: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardText: { flex: 1, marginRight: 10 },
  cardTitle: { ...typography.body, fontFamily: fonts.semiBold },
  cardSubtitle: { ...typography.caption, marginTop: 2 },
  cardArrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  loginRow: { alignItems: 'center', marginTop: 8 },
  loginPrompt: { ...typography.body },
  loginLink: { fontFamily: fonts.semiBold },
});
