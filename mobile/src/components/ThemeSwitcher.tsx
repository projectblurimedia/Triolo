import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { headerGradient, typography, useThemeColors } from '@/theme';
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
          <Pressable key={option.mode} onPress={() => setMode(option.mode)}>
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
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  pill: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pillInactive: {
    borderWidth: 1,
  },
  label: { ...typography.body },
});
