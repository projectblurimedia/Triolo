import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { typography, useThemeColors } from '@/theme';

/** Placeholder tab — a worker earnings/payments dashboard is on the post-MVP roadmap (.cloud/roadmap.md); no payment module exists yet. */
export function EarningsScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  return (
    <ScreenContainer edges={['left', 'right']}>
      <View style={styles.wrap}>
        <FontAwesome6 name="wallet" size={22} color={colors.textMuted} solid />
        <Text style={[styles.placeholder, { color: colors.textMuted }]}>{t('mainTabs.Earnings.comingSoon')}</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 20 },
  placeholder: { ...typography.body, textAlign: 'center' },
});
