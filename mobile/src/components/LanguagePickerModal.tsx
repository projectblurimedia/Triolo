import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { languageLabelKey, useSettingsStore } from '@/state/settingsStore';
import { SupportedLanguage } from '@/localization/i18n';

const OPTIONS: { code: SupportedLanguage; gradient: readonly [string, string] }[] = [
  { code: 'en', gradient: ['#0EA5E9', '#0284C7'] },
  { code: 'te', gradient: ['#F59E0B', '#D97706'] },
];

interface LanguagePickerModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called after the local language state updates (e.g. to sync it to the account once logged in). */
  onChange?: (language: SupportedLanguage) => void;
}

/** Centered language picker, mirrors ThemePickerModal exactly — tap an option to apply it and auto-close. */
export function LanguagePickerModal({ visible, onClose, onChange }: LanguagePickerModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
            <View style={styles.iconCircle}>
              <FontAwesome6 name="language" size={26} color={colors.white} solid />
            </View>
            <Text style={styles.headerTitle}>{t('languagePicker.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('languagePicker.subtitle')}</Text>
          </LinearGradient>

          <View style={styles.options}>
            {OPTIONS.map((option) => {
              const isSelected = language === option.code;
              return (
                <Pressable
                  key={option.code}
                  style={[
                    styles.option,
                    {
                      backgroundColor: colors.background,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  onPress={() => {
                    setLanguage(option.code);
                    onChange?.(option.code);
                    onClose();
                  }}
                >
                  <LinearGradient colors={option.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.optionIcon}>
                    <FontAwesome6 name="language" size={18} color={colors.white} solid />
                  </LinearGradient>
                  <Text style={[styles.optionLabel, { color: isSelected ? colors.primary : colors.text }]}>
                    {t(languageLabelKey(option.code))}
                  </Text>
                  {isSelected ? (
                    <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                      <FontAwesome6 name="check" size={12} color={colors.white} solid />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Pressable style={[styles.closeButton, { borderTopColor: colors.border }]} onPress={onClose}>
            <Text style={[styles.closeText, { color: colors.textMuted }]}>{t('common.close')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  card: { width: '100%', maxWidth: 400, borderRadius: 20, overflow: 'hidden' },
  header: { paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center' },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', marginBottom: 4 },
  headerSubtitle: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', textAlign: 'center' },
  options: { padding: 16 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 10 },
  optionIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  optionLabel: { ...typography.body, fontFamily: fonts.semiBold, flex: 1 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  closeButton: { paddingVertical: 14, alignItems: 'center', borderTopWidth: 1 },
  closeText: { ...typography.body, fontFamily: fonts.medium },
});
