import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { typography, useThemeColors } from '@/theme';
import { useThemeStore, ThemeMode } from '@/state/themeStore';

const OPTIONS: { mode: ThemeMode; labelKey: string }[] = [
  { mode: 'system', labelKey: 'settings.themeSystem' },
  { mode: 'light', labelKey: 'settings.themeLight' },
  { mode: 'dark', labelKey: 'settings.themeDark' },
];

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);

  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const isActive = mode === option.mode;
        return (
          <Pressable
            key={option.mode}
            onPress={() => setMode(option.mode)}
            style={[
              styles.pill,
              { borderColor: colors.border },
              isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            <Text style={[styles.label, { color: isActive ? colors.white : colors.text }]}>{t(option.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  label: { ...typography.body },
});
