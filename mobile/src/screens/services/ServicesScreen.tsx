import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { typography, useThemeColors } from '@/theme';

/** Placeholder until the Worker/Business search module is built (see .cloud/project-context.md). */
export function ServicesScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  return (
    <ScreenContainer edges={['left', 'right']}>
      <Text style={[styles.placeholder, { color: colors.textMuted }]}>{t('services.comingSoon')}</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  placeholder: { ...typography.body, marginTop: 20, textAlign: 'center' },
});
