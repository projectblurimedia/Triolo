import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { typography, useThemeColors } from '@/theme';

/**
 * Placeholder tab — the incoming job/order request feed depends on the Worker/Business
 * module remainder (booking + order flow, PIN verification) which is still pending per
 * .cloud/project-context.md's roadmap. This tab exists now (rather than being added later)
 * because it's the actual core value a Worker/Business partner needs from this app, unlike a
 * generic "Search" tab.
 */
export function BookingsScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  return (
    <ScreenContainer edges={['left', 'right']}>
      <View style={styles.wrap}>
        <FontAwesome6 name="calendar-check" size={22} color={colors.textMuted} solid />
        <Text style={[styles.placeholder, { color: colors.textMuted }]}>{t('mainTabs.Bookings.comingSoon')}</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 20 },
  placeholder: { ...typography.body, textAlign: 'center' },
});
