import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { fonts, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';

export function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const account = useAuthStore((state) => state.account);

  return (
    <ScreenContainer edges={['left', 'right']}>
      <Text style={[styles.greeting, { color: colors.text }]}>
        {t('home.greeting', { name: account?.fullName ?? '' })}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('home.subtitle')}</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 22, fontFamily: fonts.medium, marginTop: 20, marginBottom: 8 },
  subtitle: { fontSize: 15, fontFamily: fonts.regular },
});
