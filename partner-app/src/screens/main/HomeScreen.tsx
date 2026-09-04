import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { fonts, typography, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';

/**
 * Landing tab for verified partners. A real job/order feed depends on the Worker/Business
 * module remainder (availability, search, booking/order flow — still pending per
 * .cloud/project-context.md's roadmap), so this stays a greeting + "coming soon" placeholder
 * for now, the same honesty pattern user-app's Services/Bazaar tabs started with.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const account = useAuthStore((state) => state.account);

  return (
    <ScreenContainer edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        {account ? (
          <Text style={[styles.greeting, { color: colors.text }]}>{t('mainTabs.Home.greeting', { name: account.fullName })}</Text>
        ) : null}

        <View style={[styles.placeholderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome6 name="bell" size={22} color={colors.textMuted} solid />
          <Text style={[styles.placeholderText, { color: colors.textMuted }]}>{t('mainTabs.Home.comingSoon')}</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingVertical: 20, paddingBottom: 40 },
  greeting: { ...typography.heading, fontFamily: fonts.semiBold, fontSize: 19, marginBottom: 18 },
  placeholderCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  placeholderText: { ...typography.body, textAlign: 'center', paddingHorizontal: 20 },
});
