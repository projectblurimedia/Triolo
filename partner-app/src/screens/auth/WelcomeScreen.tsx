import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

/**
 * No language button/picker here (unlike user-app's Welcome) — kept minimal for this app's
 * first pass; device locale still drives en/te via i18n.ts. The two entry cards deliberately
 * reuse `chooseCapability.workerUnregisteredTitle`/`businessUnregisteredTitle` (and their
 * subtitles) rather than a separate `auth.*` copy of the same strings — this screen and
 * `ChooseCapabilityScreen`'s own not-yet-registered cards ask the exact same question
 * ("Are You a Worker?" / "Do You Have a Shop?"), matching `registration-web`'s
 * `LandingPage.tsx` wording, so there's one translated pair of strings, not two to keep in
 * sync. Card visuals mirror `ChooseCapabilityScreen`'s `CapabilityCard` (gradient icon
 * square, title/subtitle, chevron) for the same reason.
 */
export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <SafeAreaView edges={['top']} style={styles.heroContent}>
          <View style={styles.heroIcon}>
            <FontAwesome6 name="handshake" size={40} color="#FFFFFF" solid />
          </View>
          <Text style={styles.heroTitle}>{t('common.appName')}</Text>
          <Text style={styles.heroSubtitle}>{t('auth.welcomeTitle')}</Text>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.body}>
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
      </View>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
          <Text style={[styles.loginPrompt, { color: colors.textMuted }]}>
            {t('auth.alreadyHaveAccount')} <Text style={[styles.loginLink, { color: colors.primary }]}>{t('auth.login')}</Text>
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

interface EntryCardProps {
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  title: string;
  subtitle: string;
  colors: ReturnType<typeof useThemeColors>['colors'];
  onPress: () => void;
}

function EntryCard({ icon, title, subtitle, colors, onPress }: EntryCardProps) {
  return (
    <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress}>
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardIcon}>
        <FontAwesome6 name={icon} size={20} color="#FFFFFF" solid />
      </LinearGradient>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.cardSubtitle, { color: colors.textMuted }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <FontAwesome6 name="chevron-right" size={14} color={colors.textMuted} solid />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  heroContent: { alignItems: 'center' },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  heroTitle: { ...typography.heading, fontFamily: fonts.bold, color: '#FFFFFF', fontSize: 30 },
  heroSubtitle: {
    ...typography.body,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  body: { padding: 24, paddingBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  cardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardText: { flex: 1, marginRight: 10 },
  cardTitle: { ...typography.subheading, fontFamily: fonts.semiBold },
  cardSubtitle: { ...typography.caption, marginTop: 3 },
  footer: { alignItems: 'center', paddingVertical: 16 },
  loginPrompt: { ...typography.body },
  loginLink: { fontFamily: fonts.semiBold },
});
