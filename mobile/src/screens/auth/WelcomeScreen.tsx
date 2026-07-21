import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';
import { AccountRole } from '@/state/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const ROLE_GRADIENTS: Record<AccountRole, readonly [string, string]> = {
  user: headerGradient,
  worker: ['#16A34A', '#0F766E'],
  business_owner: ['#F59E0B', '#D97706'],
  business_staff: headerGradient,
  admin: headerGradient,
};

export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  const roles: { role: AccountRole; icon: keyof typeof FontAwesome6.glyphMap; titleKey: string; subtitleKey: string }[] = [
    { role: 'user', icon: 'user', titleKey: 'auth.roleUser', subtitleKey: 'auth.roleUserSubtitle' },
    { role: 'worker', icon: 'screwdriver-wrench', titleKey: 'auth.roleWorker', subtitleKey: 'auth.roleWorkerSubtitle' },
    { role: 'business_owner', icon: 'store', titleKey: 'auth.roleBusiness', subtitleKey: 'auth.roleBusinessSubtitle' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <SafeAreaView edges={['top']} style={styles.heroContent}>
          <View style={styles.heroIcon}>
            <FontAwesome6 name="shapes" size={40} color={colors.white} solid />
          </View>
          <Text style={styles.heroTitle}>{t('common.appName')}</Text>
          <Text style={styles.heroSubtitle}>{t('auth.welcomeTitle')}</Text>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('auth.getStarted')}</Text>
        {roles.map((item) => (
          <Pressable
            key={item.role}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Register', { role: item.role })}
          >
            <LinearGradient
              colors={ROLE_GRADIENTS[item.role]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardIcon}
            >
              <FontAwesome6 name={item.icon} size={18} color={colors.white} solid />
            </LinearGradient>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {t(item.titleKey)}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {t(item.subtitleKey)}
              </Text>
            </View>
            <FontAwesome6 name="chevron-right" size={14} color={colors.textMuted} solid />
          </Pressable>
        ))}
      </ScrollView>

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

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { paddingBottom: 28, paddingHorizontal: 24 },
  heroContent: { alignItems: 'center', paddingTop: 12 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: { ...typography.heading, fontFamily: fonts.bold, color: '#FFFFFF' },
  heroSubtitle: {
    ...typography.body,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginTop: 6,
  },
  body: { padding: 20, paddingBottom: 8 },
  sectionTitle: { ...typography.caption, fontFamily: fonts.medium, marginBottom: 12, marginLeft: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardText: { flex: 1, marginRight: 10 },
  cardTitle: { ...typography.body, fontFamily: fonts.semiBold },
  cardSubtitle: { ...typography.caption, marginTop: 2 },
  footer: { alignItems: 'center', paddingVertical: 16 },
  loginPrompt: { ...typography.body },
  loginLink: { fontFamily: fonts.semiBold },
});
