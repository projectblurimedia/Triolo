import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { headerGradient, typography, useThemeColors } from '@/theme';
import { useSettingsStore } from '@/state/settingsStore';
import { SupportedLanguage } from '@/localization/i18n';

const OPTIONS: { code: SupportedLanguage; labelKey: string }[] = [
  { code: 'en', labelKey: 'settings.english' },
  { code: 'te', labelKey: 'settings.telugu' },
];

interface LanguageSwitcherProps {
  /** Called after the local language state updates (e.g. to sync to the backend). */
  onChange?: (language: SupportedLanguage) => void;
}

export function LanguageSwitcher({ onChange }: LanguageSwitcherProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const isActive = language === option.code;
        return (
          <Pressable
            key={option.code}
            onPress={() => {
              setLanguage(option.code);
              onChange?.(option.code);
            }}
          >
            {isActive ? (
              <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pill}>
                <Text style={[styles.label, { color: colors.white }]}>{t(option.labelKey)}</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.pill, styles.pillInactive, { borderColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.text }]}>{t(option.labelKey)}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  pill: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  pillInactive: {
    borderWidth: 1,
  },
  label: { ...typography.body },
});
