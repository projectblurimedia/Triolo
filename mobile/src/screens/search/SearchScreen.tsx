import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { colors, typography } from '@/theme';

/** Placeholder until the Worker/Business search module is built (see .cloud/project-context.md). */
export function SearchScreen() {
  const { t } = useTranslation();

  return (
    <ScreenContainer edges={['left', 'right']}>
      <Text style={styles.placeholder}>{t('search.comingSoon')}</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  placeholder: { ...typography.body, color: colors.textMuted, marginTop: 20, textAlign: 'center' },
});
