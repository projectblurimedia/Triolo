import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { colors, typography } from '@/theme';
import { useSettingsStore } from '@/state/settingsStore';

/**
 * Shown once, before anything else, on first app launch (see docs/localization.md).
 * The device locale pre-selects a default in settingsStore, but the user must
 * actively confirm before proceeding — never silently assumed.
 */
export function LanguageSelectScreen() {
  const { t } = useTranslation();
  const confirmLanguage = useSettingsStore((state) => state.confirmLanguage);

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>{t('languageSelect.title')}</Text>
        <Text style={styles.subtitle}>{t('languageSelect.subtitle')}</Text>
        <View style={styles.switcher}>
          <LanguageSwitcher />
        </View>
        <Button label={t('languageSelect.continue')} onPress={confirmLanguage} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center' },
  title: { ...typography.heading, color: colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: 32 },
  switcher: { alignItems: 'center', marginBottom: 40 },
});
