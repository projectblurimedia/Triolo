import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '@/components/Button';
import { LanguagePickerModal } from '@/components/LanguagePickerModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

/**
 * Every self-registered account is just a `user` — Worker/Business are optional
 * capabilities added during registration's optional step or later via Home's menu
 * (see .cloud/project-context.md's "Account Model" section), not an exclusive role
 * chosen here. So Welcome is a single "Create Account" entry point, not a role picker.
 */
export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Pressable
          style={[styles.languageButton, { top: insets.top + 14 }]}
          onPress={() => setLanguagePickerVisible(true)}
          accessibilityLabel={t('settings.language')}
          hitSlop={8}
        >
          <FontAwesome6 name="language" size={16} color="#FFFFFF" solid />
        </Pressable>
        <SafeAreaView edges={['top']} style={styles.heroContent}>
          <View style={styles.heroIcon}>
            <FontAwesome6 name="shapes" size={40} color="#FFFFFF" solid />
          </View>
          <Text style={styles.heroTitle}>{t('common.appName')}</Text>
          <Text style={styles.heroSubtitle}>{t('auth.welcomeTitle')}</Text>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.body}>
        <Button label={t('auth.createAccount')} onPress={() => navigation.navigate('Register')} />
      </View>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
          <Text style={[styles.loginPrompt, { color: colors.textMuted }]}>
            {t('auth.alreadyHaveAccount')} <Text style={[styles.loginLink, { color: colors.primary }]}>{t('auth.login')}</Text>
          </Text>
        </Pressable>
      </SafeAreaView>

      <LanguagePickerModal visible={languagePickerVisible} onClose={() => setLanguagePickerVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
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
  footer: { alignItems: 'center', paddingVertical: 16 },
  loginPrompt: { ...typography.body },
  loginLink: { fontFamily: fonts.semiBold },
});
