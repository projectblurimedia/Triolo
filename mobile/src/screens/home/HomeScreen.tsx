import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { colors, typography } from '@/theme';
import { useAuthStore } from '@/state/authStore';
import { useLogout, useUpdateAccountLanguage } from '@/hooks/useAuthMutations';

export function HomeScreen() {
  const { t } = useTranslation();
  const account = useAuthStore((state) => state.account);
  const logout = useLogout();
  const updateLanguage = useUpdateAccountLanguage();

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
        <Text style={styles.label}>{t('settings.language')}</Text>
        {/* Persists locally immediately; also synced to the account so it follows the user to a new device. */}
        <LanguageSwitcher onChange={(language) => updateLanguage.mutate(language)} />
      </View>

      <Button label={t('common.logout')} onPress={() => logout.mutate()} loading={logout.isPending} />
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
