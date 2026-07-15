import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { colors, typography } from '@/theme';
import { useAuthStore } from '@/state/authStore';

export function HomeScreen() {
  const { t } = useTranslation();
  const account = useAuthStore((state) => state.account);

  return (
    <ScreenContainer edges={['left', 'right']}>
      <Text style={styles.greeting}>
        {t('home.greeting', { name: account?.fullName ?? '' })}
      </Text>
      <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greeting: { ...typography.heading, color: colors.text, marginTop: 20, marginBottom: 8 },
  subtitle: { ...typography.body, color: colors.textMuted },
});
