import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, typography } from '@/theme';
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
            style={[styles.pill, isActive && styles.pillActive]}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{t(option.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: { ...typography.body, color: colors.text },
  labelActive: { color: '#fff' },
});
