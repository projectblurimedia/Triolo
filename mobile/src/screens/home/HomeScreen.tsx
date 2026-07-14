import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { colors, typography } from '@/theme';
import { useAuthStore } from '@/state/authStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useLogout } from '@/hooks/useAuthMutations';

export function HomeScreen() {
  const { t } = useTranslation();
  const account = useAuthStore((state) => state.account);
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const logout = useLogout();

  return (
    <ScreenContainer>
      <Text style={styles.heading}>{t('common.appName')}</Text>
      {account ? (
        <View style={styles.card}>
          <Text style={styles.name}>{account.fullName}</Text>
          <Text style={styles.meta}>{account.mobileNumber}</Text>
          <Text style={styles.meta}>{account.role} · {account.status}</Text>
        </View>
      ) : null}

      <View style={styles.languageRow}>
        <Text style={styles.label}>{t('settings.language')}:</Text>
        <Button
          label={t('settings.english')}
          onPress={() => setLanguage('en')}
          disabled={language === 'en'}
        />
        <Button
          label={t('settings.telugu')}
          onPress={() => setLanguage('te')}
          disabled={language === 'te'}
        />
      </View>

      <Button label="Log out" onPress={() => logout.mutate()} loading={logout.isPending} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.heading, marginBottom: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
  },
  name: { ...typography.subheading, color: colors.text },
  meta: { ...typography.body, color: colors.textMuted, marginTop: 4 },
  languageRow: { gap: 10, marginBottom: 24 },
  label: { ...typography.body, color: colors.textMuted },
});
