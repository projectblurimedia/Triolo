import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { typography, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';
import { useLogout, useUpdateAccountLanguage } from '@/hooks/useAuthMutations';

export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const account = useAuthStore((state) => state.account);
  const logout = useLogout();
  const updateLanguage = useUpdateAccountLanguage();

  return (
    <ScreenContainer edges={['left', 'right']}>
      {account ? (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.name, { color: colors.text }]}>{account.fullName}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{account.mobileNumber}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {account.role} · {account.status}
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('settings.language')}</Text>
        {/* Persists locally immediately; also synced to the account so it follows the user to a new device. */}
        <LanguageSwitcher onChange={(language) => updateLanguage.mutate(language)} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('settings.theme')}</Text>
        <ThemeSwitcher />
      </View>

      <Button label={t('common.logout')} onPress={() => logout.mutate()} loading={logout.isPending} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    padding: 16,
    marginTop: 20,
    marginBottom: 24,
  },
  name: { ...typography.subheading },
  meta: { ...typography.body, marginTop: 4 },
  section: { gap: 10, marginBottom: 24 },
  label: { ...typography.body },
});
